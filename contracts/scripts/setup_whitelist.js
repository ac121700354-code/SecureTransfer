const { ethers } = require("hardhat");
const deployment = require("../deployment.json");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

// Mock Aggregator Address (Deployed previously)
const MOCK_FEED_ADDRESS = deployment.contracts.MockAggregator;

// Tokens Configuration
const TOKENS = [
    { symbol: "BNB", address: ethers.ZeroAddress }, // Native
    { symbol: "BFR", address: deployment.contracts.BufferToken },
    { symbol: "USDT", address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" },
    { symbol: "USDC", address: "0x64544969ed7EBf5f083679233325356EbE738930" },
    { symbol: "BTC", address: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8" },
    { symbol: "ETH", address: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378" }
];

async function main() {
    console.log("Starting Whitelist Setup...");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with: ${wallet.address}`);

    const escrowAddress = deployment.contracts.EscrowProxy;
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress).connect(wallet);

    const feeCollectorAddress = deployment.contracts.FeeCollector;
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(wallet);

    console.log(`Using Mock Feed: ${MOCK_FEED_ADDRESS}`);

    for (const t of TOKENS) {
        console.log(`\nConfiguring ${t.symbol} (${t.address})...`);
        
        try {
            // 1. Set Feed in Escrow
            console.log("- Setting Escrow Feed...");
            let tx = await escrow.setTokenPriceFeed(t.address, MOCK_FEED_ADDRESS);
            await tx.wait();
            console.log("  Done.");

            // 2. Set Feed in FeeCollector (Important for Buyback)
            console.log("- Setting FeeCollector Feed...");
            tx = await feeCollector.setPriceFeed(t.address, MOCK_FEED_ADDRESS);
            await tx.wait();
            console.log("  Done.");
            
        } catch (err) {
            console.error(`  Failed: ${err.message}`);
        }
    }

    console.log("\nAll tokens whitelisted successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
