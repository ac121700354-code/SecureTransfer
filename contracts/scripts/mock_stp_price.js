const { ethers } = require("hardhat");
const deployment = require("../deployment.json");
require("dotenv").config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const RPC_URL = process.env.RPC_URL || "https://bsc-testnet.publicnode.com";

async function main() {
    console.log("Starting Mock STP Price Setup...");

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with: ${wallet.address}`);

    const escrowAddress = deployment.contracts.EscrowProxy;
    const feeCollectorAddress = deployment.contracts.FeeCollector;
    const bufferTokenAddress = deployment.contracts.BufferToken;

    // 1. 设置 Mock 价格 ($100)
    console.log("\n1. Setting Mock Price for STP to $100...");
    // MockAggregator decimals = 8 (标准 Chainlink)
    // $100 = 100 * 10^8 = 10000000000
    const mockPrice = 10000000000; 
    
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const mockFeed = await MockAggregator.connect(wallet).deploy(8, mockPrice);
    await mockFeed.waitForDeployment();
    const mockFeedAddress = await mockFeed.getAddress();
    console.log(`New Mock Feed deployed at: ${mockFeedAddress}`);

    // 2. 将 STP 的预言机设置为这个 Mock Feed
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(wallet);
    
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress).connect(wallet);

    console.log("Setting Price Feed in FeeCollector...");
    let tx = await feeCollector.setPriceFeed(bufferTokenAddress, mockFeedAddress);
    await tx.wait();
    console.log("FeeCollector feed updated.");

    console.log("Setting Price Feed in Escrow...");
    tx = await escrow.setTokenPriceFeed(bufferTokenAddress, mockFeedAddress);
    await tx.wait();
    console.log("Escrow feed updated.");

    console.log("\nSetup Completed! STP is now priced at $100.");
    console.log("You can now test STP transfers on the frontend.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
