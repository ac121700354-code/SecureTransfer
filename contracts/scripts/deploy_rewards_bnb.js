const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const distributionConfig = require("./distribution_config.js");

async function main() {
    console.log(`Deploying ActivityRewards to ${network.name}...`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    // Configuration for BNB Chain
    let tokenAddress;
    
    // Load frontend config to find existing token
    const configPath = path.join(__dirname, "../../handshake-web/src/config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath));
    }

    const chainId = network.config.chainId;
    const chainConfig = config[chainId.toString()];

    if (chainConfig && chainConfig.tokens) {
        // Try to find HSK or STP or BufferToken
        const token = chainConfig.tokens.find(t => t.symbol === "HSK" || t.symbol === distributionConfig.tokenSymbol);
        if (token) {
            tokenAddress = token.address;
            console.log(`Found Token in config: ${token.symbol} (${tokenAddress})`);
        }
    }

    // Fallback or override if not found
    if (!tokenAddress) {
        if (chainId === 97) { // BNB Testnet
            tokenAddress = "0x1e540D666acdEda1c3Ca3f98675A34f3F9756aA8"; // HSK from previous read
            console.log(`Using hardcoded HSK address: ${tokenAddress}`);
        } else if (chainId === 56) { // BNB Mainnet
            throw new Error("Token address for Mainnet not found. Please set it manually.");
        } else {
            console.warn("Token address not found, deploying new mock token? No, aborting.");
            // For local testing, we might deploy one, but this script is for BNB
             const BufferToken = await ethers.getContractFactory("BufferToken");
             const token = await BufferToken.deploy(deployer.address, deployer.address, ethers.parseEther("1000000"));
             await token.waitForDeployment();
             tokenAddress = await token.getAddress();
             console.log(`Deployed new Mock Token: ${tokenAddress}`);
        }
    }

    // Deploy ActivityRewards
    console.log("Deploying ActivityRewards...");
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    
    // Constructor: (token, signer)
    // We use deployer as the initial signer
    const rewards = await ActivityRewards.deploy(tokenAddress, deployer.address);
    await rewards.waitForDeployment();
    
    const rewardsAddress = await rewards.getAddress();
    console.log(`ActivityRewards deployed to: ${rewardsAddress}`);

    // Update config.json with new contract address
    if (chainConfig) {
        if (!chainConfig.contracts) chainConfig.contracts = {};
        
        chainConfig.contracts.ActivityRewards = {
            address: rewardsAddress,
            abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/ActivityRewards.sol/ActivityRewards.json"))).abi
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Updated config.json for chain ${chainId}`);
    }

    // Verify (Optional, prints command)
    console.log("\nTo verify on BscScan:");
    console.log(`npx hardhat verify --network ${network.name} ${rewardsAddress} ${tokenAddress} ${deployer.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
