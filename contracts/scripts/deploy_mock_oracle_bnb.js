const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // 1. Deploy MockAggregator
    console.log("Deploying MockAggregator...");
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    // Initial Price: $300 (8 decimals) = 300 * 10^8
    const mockPrice = 30000000000n; 
    const aggregator = await MockAggregator.deploy(8, mockPrice);
    await aggregator.waitForDeployment();
    const aggregatorAddress = await aggregator.getAddress();
    console.log(`MockAggregator deployed to: ${aggregatorAddress}`);

    // 2. Configure Escrow to use this Mock
    // Escrow Address from config (or hardcoded if you know it)
    const escrowAddress = "0xc47169416c9645F858ff9185Dd3950fad6A99694"; 
    const NATIVE_TOKEN = ethers.ZeroAddress;

    console.log(`Configuring Escrow (${escrowAddress}) to use MockAggregator...`);
    const Escrow = await ethers.getContractAt("SecureHandshakeUnlimitedInbox", escrowAddress);

    // Set Native Token Feed
    const tx = await Escrow.setTokenPriceFeed(NATIVE_TOKEN, aggregatorAddress);
    await tx.wait();
    console.log("Escrow: Native Token Price Feed Updated to Mock!");

    // Set Token Feed (if needed, for HSK/STP)
    // const HSK_ADDRESS = "...";
    // await Escrow.setTokenPriceFeed(HSK_ADDRESS, aggregatorAddress);

    console.log("Done! You can now test without 'Price expired' error.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
