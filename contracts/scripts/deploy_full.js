const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const networkConfig = require("../network-config.js");
const distributionConfig = require("./distribution_config.js");

// Configuration
// Dynamic loading from network-config.js
const currentNet = networkConfig[network.name];
if (!currentNet) {
    throw new Error(`Network configuration for '${network.name}' not found in network-config.js`);
}

const ROUTER_ADDRESS = currentNet.router;
const WBNB_ADDRESS = currentNet.weth; // This represents Native Wrapped Token (WETH/WBNB)

const TEAM_WALLET = process.env.TEAM_WALLET; 

async function main() {
    console.log(`Deploying contracts to [${network.name}]...`);
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // --- 0. Deploy Timelock ---
    console.log("\n0. Deploying Timelock...");
    const Timelock = await ethers.getContractFactory("Timelock");
    const minDelay = 24 * 60 * 60; // 24 hours
    const proposers = [deployer.address];
    const executors = [ethers.ZeroAddress]; // Anyone can execute
    const admin = deployer.address;

    const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    console.log(`Timelock deployed to: ${timelockAddress}`);

    // --- 1. Deploy BufferToken ---
    console.log("\n1. Deploying BufferToken...");
    const BufferToken = await ethers.getContractFactory("BufferToken");
    
    // Determine Initial Supply
    // BNB Chain (Mainnet/Testnet) = 100M
    // Testnets (Sepolia/Hardhat) = 100M (For testing convenience)
    // Other Mainnets (ETH/Arb) = 0 (Side chain mode)
    let initialSupply = 0n;
    if (network.name.includes("bnb") || network.name.includes("sepolia") || network.name === "hardhat") {
        initialSupply = ethers.parseUnits("100000000", 18);
        console.log(`  - Minting 100M ${distributionConfig.tokenSymbol} (Chain: ${network.name})`);
    } else {
        console.log(`  - Side Chain Mode: Initial Supply 0 (Chain: ${network.name})`);
    }

    // Pass the real Timelock address
    const bufferToken = await BufferToken.deploy(deployer.address, timelockAddress, initialSupply);
    await bufferToken.waitForDeployment();
    const bufferTokenAddress = await bufferToken.getAddress();
    console.log(`BufferToken deployed to: ${bufferTokenAddress}`);

    // --- 2. Distribute Initial Tokens ---
    console.log("\n2. Distributing Tokens based on distribution_config.js...");
    
    // We assume the deployer holds all tokens initially (minted in step 1)
    // distributionConfig.distribution contains the plan
    
    for (const [key, info] of Object.entries(distributionConfig.distribution)) {
        // Skip if address is invalid or placeholder
        if (!info.address || info.address.startsWith("0x...") || !ethers.isAddress(info.address)) {
            console.warn(`  [Warning] Skipping distribution for '${key}' (${info.description}): Invalid address '${info.address}'`);
            continue;
        }

        const amountWei = ethers.parseUnits(info.amount, 18);
        
        // Skip if amount is 0
        if (amountWei === 0n) continue;

        console.log(`  - Transferring ${info.percentage}% (${info.amount} ${distributionConfig.tokenSymbol}) to ${info.description}...`);
        try {
            const tx = await bufferToken.transfer(info.address, amountWei);
            await tx.wait();
            console.log(`    Success: Tx Hash: ${tx.hash}`);
        } catch (err) {
            console.error(`    Failed to transfer to ${key}: ${err.message}`);
        }
    }
    
    // Check remaining balance of deployer (should be 0 if all distributed, or remainder)
    const deployerBalance = await bufferToken.balanceOf(deployer.address);
    console.log(`  Deployer remaining balance: ${ethers.formatUnits(deployerBalance, 18)} ${distributionConfig.tokenSymbol}`);

    // --- 3. Deploy FeeCollector ---
    console.log("\n3. Deploying FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    // Use DAO_WALLET from env as DAO Treasury
    const daoTreasury = process.env.DAO_WALLET || deployer.address;
    
    console.log(`  FeeCollector DAO Treasury: ${daoTreasury}`);

    const feeCollector = FeeCollector.deploy(
        bufferTokenAddress,
        ROUTER_ADDRESS,
        WBNB_ADDRESS,
        daoTreasury
    );
    await (await feeCollector).waitForDeployment();
    const feeCollectorAddress = await (await feeCollector).getAddress();
    console.log(`FeeCollector deployed to: ${feeCollectorAddress}`);

    // --- 4. Deploy Escrow (UUPS Proxy) ---
    console.log("\n4. Deploying Escrow (UUPS)...");
    const EscrowProxy = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    
    // Always deploy new implementation for clean state
    console.log("  Deploying new Implementation...");
    const escrowImpl = await EscrowProxy.deploy();
    await escrowImpl.waitForDeployment();
    const escrowImplAddress = await escrowImpl.getAddress();
    console.log(`  > Implementation deployed to: ${escrowImplAddress}`);
    
    // Deploy ERC1967 Proxy
    console.log("  Deploying ERC1967 Proxy...");
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    // Encode Initialize Call
    const initData = EscrowProxy.interface.encodeFunctionData("initialize", [
        feeCollectorAddress
    ]);
    
    const proxy = await ERC1967Proxy.deploy(escrowImplAddress, initData);
    await proxy.waitForDeployment();
    const escrowAddress = await proxy.getAddress();
    console.log(`Escrow Proxy deployed to: ${escrowAddress}`);

    // --- 5. Deploy Mock Aggregator (Testnet Only) ---
    let aggregatorAddress;
    // Check if network is a testnet or we want to force mocks
    if (network.name.includes("testnet") || network.name === "hardhat" || network.name === "localhost" || network.name === "sepolia") {
        console.log("\n5. Deploying MockAggregator...");
        const MockAggregator = await ethers.getContractFactory("MockAggregator");
        const mockPrice = 30000000000n; // $300 (8 decimals)
        const aggregator = await MockAggregator.deploy(8, mockPrice);
        await aggregator.waitForDeployment();
        aggregatorAddress = await aggregator.getAddress();
        console.log(`MockAggregator deployed to: ${aggregatorAddress}`);
    } else {
        // Mainnet: Use Chainlink (Needs config)
        console.log("\n5. Skipping MockAggregator (Mainnet). Configure real feeds manually.");
        // TODO: Load real feeds from network-config.js
    }

    // --- 6. Deploy ActivityRewards ---
    console.log("\n6. Deploying ActivityRewards...");
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    // Deploy with a signer address (using deployer for now)
    const activityRewards = await ActivityRewards.deploy(bufferTokenAddress, deployer.address);
    await activityRewards.waitForDeployment();
    const activityRewardsAddress = await activityRewards.getAddress();
    console.log(`ActivityRewards deployed to: ${activityRewardsAddress}`);

    // Fund ActivityRewards with Community Tokens (from Deployer)
    // Deployer holds initial supply. We transfer some for rewards.
    // Let's fund 1M STP for rewards initially
    const rewardFundAmount = ethers.parseUnits("1000000", 18);
    console.log(`  Funding ActivityRewards with 1M ${distributionConfig.tokenSymbol}...`);
    const fundTx = await bufferToken.transfer(activityRewardsAddress, rewardFundAmount);
    await fundTx.wait();
    console.log("  Funded.");

    // --- 7. Post-Deployment Setup ---
    console.log("Setting Token Price Feed...");
    // Set Native Token Feed in Escrow
    if (aggregatorAddress) {
        // escrowContract is already defined above if we ran step 6, but if we skipped it might not be.
        // Re-attach to be safe
        const escrowContract = EscrowProxy.attach(escrowAddress).connect(deployer);
        await escrowContract.setTokenPriceFeed(ethers.ZeroAddress, aggregatorAddress);
        console.log("Set Native Token Price Feed to Mock");
    }

    // --- 8. Whitelist Setup (Auto) ---
    console.log("\n7. Configuring Whitelist (Auto)...");
    if (aggregatorAddress) {
        const escrowContract = EscrowProxy.attach(escrowAddress).connect(deployer);
        const feeCollectorContract = FeeCollector.attach(feeCollectorAddress).connect(deployer);
        
        // Define tokens to whitelist
        const TOKENS_TO_WHITELIST = [
            { symbol: "BNB/ETH (Native)", address: ethers.ZeroAddress },
            { symbol: distributionConfig.tokenSymbol, address: bufferTokenAddress },
            { symbol: "USDT", address: currentNet.tokens.USDT },
            { symbol: "USDC", address: currentNet.tokens.USDC },
            { symbol: "BTC", address: currentNet.tokens.BTC },
            { symbol: "ETH", address: currentNet.tokens.ETH }
        ];

        for (const t of TOKENS_TO_WHITELIST) {
            // Skip if address is missing or invalid
            if (!t.address || t.address === ethers.ZeroAddress) {
                // For Native, we already set it above, but let's double check FeeCollector
                if (t.address === ethers.ZeroAddress) {
                     // Native handling
                } else {
                    console.log(`  Skipping ${t.symbol} (Invalid Address)`);
                    continue;
                }
            }

            console.log(`  Configuring ${t.symbol} (${t.address})...`);
            try {
                // 1. Set Feed in Escrow (if not already set for Native)
                if (t.address !== ethers.ZeroAddress) {
                     let tx = await escrowContract.setTokenPriceFeed(t.address, aggregatorAddress);
                     await tx.wait();
                     console.log("    - Escrow Feed Set");
                }

                // 2. Set Feed in FeeCollector
                let tx = await feeCollectorContract.setPriceFeed(t.address, aggregatorAddress);
                await tx.wait();
                console.log("    - FeeCollector Feed Set");
            } catch (err) {
                console.warn(`    ! Failed: ${err.message}`);
            }
        }
    } else {
        console.log("Skipping whitelist setup (No Aggregator available)");
    }

    // --- 9. Save Deployment Info ---
    const deploymentInfo = {
        network: {
            name: network.name,
            chainId: network.config.chainId
        },
        contracts: {
            BufferToken: bufferTokenAddress,
            FeeCollector: feeCollectorAddress,
            EscrowProxy: escrowAddress,
            MockAggregator: aggregatorAddress,
            Timelock: timelockAddress,
            ActivityRewards: activityRewardsAddress
        }
    };

    // Save to local JSON (contracts/deployment.json)
    fs.writeFileSync(
        path.join(__dirname, "../deployment.json"),
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\nDeployment info saved to deployment.json");

    // --- 8. Update Frontend Config (Multi-chain Support) ---
    const frontendConfigPath = path.join(__dirname, "../../handshake-web/src/config.json");
    let frontendConfig = {};
    
    if (fs.existsSync(frontendConfigPath)) {
        try {
            frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath));
        } catch (e) {
            console.warn("Could not parse existing frontend config, creating new.");
        }
    }

    // Construct new config entry for this chain
    const chainId = network.config.chainId.toString();
    
    // Construct Tokens List
    const tokensList = [];
    
    // 1. Native Token
    if (network.name.includes("bnb") || network.name.includes("bsc")) {
        tokensList.push({
            symbol: "BNB",
            name: "BNB",
            logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=035",
            address: ethers.ZeroAddress
        });
    } else {
        tokensList.push({
            symbol: "ETH",
            name: "Ethereum",
            logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=035",
            address: ethers.ZeroAddress
        });
    }

    // 2. Buffer Token
    tokensList.push({
        symbol: distributionConfig.tokenSymbol,
        "name": "Handshk Token",
        logo: "/tokens/bfr-logo.svg?v=12",
        address: bufferTokenAddress
    });

    // 3. Others from config
    const standardTokens = [
        { key: "USDT", name: "Tether USD", logo: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=035" },
        { key: "USDC", name: "USD Coin", logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035" },
        { key: "BTC", name: "Bitcoin", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=035" },
        { key: "ETH", name: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=035" }
    ];

    for (const t of standardTokens) {
        if (currentNet.tokens[t.key] && currentNet.tokens[t.key] !== ethers.ZeroAddress) {
             tokensList.push({
                 symbol: t.key,
                 name: t.name,
                 logo: t.logo,
                 address: currentNet.tokens[t.key]
             });
        }
    }

    frontendConfig[chainId] = {
        networkName: network.name,
        rpcUrl: network.config.url || "",
        explorer: "", // TODO: Add explorer URL to network-config
        tokens: tokensList,
        contracts: {
            BufferToken: {
                address: bufferTokenAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/BufferToken.sol/BufferToken.json"))).abi
            },
            EscrowProxy: {
                address: escrowAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Escrow.sol/SecureHandshakeUnlimitedInbox.json"))).abi
            },
            MockAggregator: {
                address: aggregatorAddress,
                abi: aggregatorAddress ? JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/MockAggregator.sol/MockAggregator.json"))).abi : []
            },
            Timelock: {
                address: timelockAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Timelock.sol/Timelock.json"))).abi
            },
            ActivityRewards: {
                address: activityRewardsAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/ActivityRewards.sol/ActivityRewards.json"))).abi
            },
            // Add Token Addresses from config
            USDT: { address: currentNet.tokens.USDT },
            USDC: { address: currentNet.tokens.USDC },
            BTC: { address: currentNet.tokens.BTC },
            ETH: { address: currentNet.tokens.ETH }
        }
    };

    fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
    console.log(`Frontend config updated for Chain ID ${chainId}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});