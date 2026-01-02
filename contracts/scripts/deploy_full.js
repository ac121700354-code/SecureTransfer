const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const networkConfig = require("../network-config.js");

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
        console.log(`  - Minting 100M BFR (Chain: ${network.name})`);
    } else {
        console.log(`  - Side Chain Mode: Initial Supply 0 (Chain: ${network.name})`);
    }

    const bufferToken = await BufferToken.deploy(deployer.address, initialSupply);
    await bufferToken.waitForDeployment();
    const bufferTokenAddress = await bufferToken.getAddress();
    console.log(`BufferToken deployed to: ${bufferTokenAddress}`);

    // --- 2. Distribute Initial Tokens ---
    console.log("\n2. Distributing Tokens...");
    // Transfer 15% to Team
    const teamAmount = ethers.parseUnits("15000000", 18); // 15M
    let targetWallet = TEAM_WALLET;
    if (!ethers.isAddress(targetWallet)) {
        console.warn("Invalid or missing TEAM_WALLET in .env, using deployer address instead.");
        targetWallet = deployer.address;
    }
    
    if (targetWallet !== deployer.address) {
        await bufferToken.transfer(targetWallet, teamAmount);
        console.log(`Transferred ${ethers.formatUnits(teamAmount, 18)} BFR to Team (${targetWallet})`);
    } else {
        console.log("Tokens kept in deployer wallet (Dev Mode).");
    }

    // --- 3. Deploy FeeCollector ---
    console.log("\n3. Deploying FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.deploy(
        bufferTokenAddress,
        ROUTER_ADDRESS,
        WBNB_ADDRESS
    );
    await (await feeCollector).waitForDeployment();
    const feeCollectorAddress = await (await feeCollector).getAddress();
    console.log(`FeeCollector deployed to: ${feeCollectorAddress}`);

    // --- 4. Deploy Escrow (UUPS Proxy) ---
    console.log("\n4. Deploying Escrow (UUPS)...");
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = await ethers.deployContract("SecureHandshakeUnlimitedInbox", [], {
        libraries: {},
    }); // Note: UUPS usually requires Upgrades plugin, but here we use simple deploy for now or assume UUPS pattern
    
    // Proper UUPS Deployment using Hardhat Upgrades (Recommended)
    // const escrow = await upgrades.deployProxy(Escrow, [
    //     feeCollectorAddress, 
    //     bufferTokenAddress
    // ], { initializer: 'initialize', kind: 'uups' });
    
    // Since we don't have upgrades plugin installed/configured in this snippet context,
    // let's assume direct deployment or standard proxy pattern.
    // Reverting to direct deployment as per previous scripts for consistency:
    const EscrowProxy = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    // Deploy Implementation
    const escrowImpl = await EscrowProxy.deploy();
    await escrowImpl.waitForDeployment();
    
    // Deploy ERC1967 Proxy
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    // Encode Initialize Call
    const initData = EscrowProxy.interface.encodeFunctionData("initialize", [
        feeCollectorAddress
    ]);
    const proxy = await ERC1967Proxy.deploy(await escrowImpl.getAddress(), initData);
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

    // --- 6. Post-Deployment Setup ---
    console.log("Setting Token Price Feed...");
    // Set Native Token Feed in Escrow
    if (aggregatorAddress) {
        const escrowContract = EscrowProxy.attach(escrowAddress).connect(deployer);
        await escrowContract.setTokenPriceFeed(ethers.ZeroAddress, aggregatorAddress);
        console.log("Set Native Token Price Feed to Mock");
    }

    // --- 7. Whitelist Setup (Auto) ---
    console.log("\n6. Configuring Whitelist (Auto)...");
    if (aggregatorAddress) {
        const escrowContract = EscrowProxy.attach(escrowAddress).connect(deployer);
        const feeCollectorContract = FeeCollector.attach(feeCollectorAddress).connect(deployer);
        
        // Define tokens to whitelist
        const TOKENS_TO_WHITELIST = [
            { symbol: "BNB/ETH (Native)", address: ethers.ZeroAddress },
            { symbol: "BFR", address: bufferTokenAddress },
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

    // --- 8. Save Deployment Info ---
    const deploymentInfo = {
        network: {
            name: network.name,
            chainId: network.config.chainId
        },
        contracts: {
            BufferToken: bufferTokenAddress,
            FeeCollector: feeCollectorAddress,
            EscrowProxy: escrowAddress,
            MockAggregator: aggregatorAddress
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
    
    frontendConfig[chainId] = {
        networkName: network.name,
        rpcUrl: network.config.url || "",
        explorer: "", // TODO: Add explorer URL to network-config
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
