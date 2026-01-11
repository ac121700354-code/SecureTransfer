const { ethers, network } = require("hardhat");
const { getDeployedAddress } = require("../utils");
const tokenFeeds = require("../../token_feeds.json");

async function main() {
    console.log(`\n--- 05. Setup & Permissions ---`);
    const [deployer] = await ethers.getSigners();
    
    // Load Addresses
    const timelockAddr = getDeployedAddress("Timelock");
    const escrowAddr = getDeployedAddress("EscrowProxy");
    const feeCollectorAddr = getDeployedAddress("FeeCollector");
    const rewardsAddr = getDeployedAddress("ActivityRewards");
    
    // Contracts
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    
    const escrow = Escrow.attach(escrowAddr);
    const feeCollector = FeeCollector.attach(feeCollectorAddr);
    const rewards = ActivityRewards.attach(rewardsAddr);

    // 1. Configure Oracles
    console.log("📡 Configuring Oracles...");
    const isTestnet = network.name !== "bnb_mainnet" && network.name !== "ethereum";
    let aggregatorAddr;

    if (isTestnet) {
        console.log("   Testnet: Deploying MockAggregator...");
        const MockAggregator = await ethers.getContractFactory("MockAggregator");
        const agg = await MockAggregator.deploy(8, 30000000000n); // $300
        await agg.waitForDeployment();
        aggregatorAddr = await agg.getAddress();
    } else {
        const feeds = tokenFeeds[network.config.chainId.toString()];
        const nativeFeed = feeds?.find(f => f.address === ethers.ZeroAddress);
        if (nativeFeed) aggregatorAddr = nativeFeed.feed;
    }

    if (aggregatorAddr) {
        console.log(`   Setting Native Feed to: ${aggregatorAddr}`);
        await (await escrow.setTokenPriceFeed(ethers.ZeroAddress, aggregatorAddr)).wait();
        await (await feeCollector.setPriceFeed(ethers.ZeroAddress, aggregatorAddr)).wait();
    }

    // 2. Transfer Ownership to Timelock
    console.log("🔑 Transferring Ownership to Timelock...");
    
    if ((await escrow.owner()) !== timelockAddr) {
        console.log("   - Escrow...");
        await (await escrow.transferOwnership(timelockAddr)).wait();
    }
    
    if ((await feeCollector.owner()) !== timelockAddr) {
        console.log("   - FeeCollector...");
        await (await feeCollector.transferOwnership(timelockAddr)).wait();
    }

    if ((await rewards.owner()) !== timelockAddr) {
        console.log("   - ActivityRewards...");
        await (await rewards.transferOwnership(timelockAddr)).wait();
    }

    console.log("✨ All Setup Complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
