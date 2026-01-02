const { ethers } = require("hardhat");
const cron = require("node-cron");
const deployment = require("../deployment.json");
require("dotenv").config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Ensure this is set in .env
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function main() {
    console.log("Starting Daily Maintenance Script...");

    // Connect to provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with wallet: ${wallet.address}`);

    // Load Contracts
    const escrowAddress = deployment.contracts.EscrowProxy;
    const feeCollectorAddress = deployment.contracts.FeeCollector;

    // We need ABIs. For simplicity, we can use the artifacts if running within Hardhat context,
    // or minimal interfaces. Here we rely on Hardhat's artifacts.
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress).connect(wallet);

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(wallet);

    // --- Task 1: Execute Expired Refunds ---
    console.log("\n--- Task 1: Checking for Expired Refunds ---");
    // Note: The contract doesn't have a "getAllExpired" function. 
    // In a real production scenario, we should have an off-chain indexer (The Graph) to find expired IDs.
    // For this script, we will iterate through a known list or events. 
    // Since we don't have an indexer here, we will demonstrate how to check specific IDs if we knew them,
    // OR we can fetch recent `TransferInitiated` events and check their status.
    
    // Fetch events from the last 7 days (default TTL) + buffer
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 201600; // Approx 7 days (201600 blocks on BSC @ 3s/block)
    
    console.log(`Scanning events from block ${fromBlock} to ${currentBlock}...`);
    
    const filter = escrow.filters.TransferInitiated();
    const events = await escrow.queryFilter(filter, fromBlock, currentBlock);
    
    let expiredCount = 0;
    
    for (const event of events) {
        const id = event.args[0];
        try {
            const record = await escrow.activeTransfers(id);
            // Check if record exists (receiver != 0) and is expired
            if (record.receiver !== ethers.ZeroAddress) {
                const now = Math.floor(Date.now() / 1000);
                if (record.expiresAt < now) {
                    console.log(`Found expired order: ${id}`);
                    console.log(`- ExpiresAt: ${record.expiresAt}, Now: ${now}`);
                    
                    // Execute expire()
                    const tx = await escrow.expire(id);
                    console.log(`- Triggered expire tx: ${tx.hash}`);
                    await tx.wait();
                    console.log(`- Successfully expired and refunded.`);
                    expiredCount++;
                }
            }
        } catch (err) {
            console.error(`Error processing ID ${id}:`, err.message);
        }
    }
    
    if (expiredCount === 0) {
        console.log("No expired orders found.");
    }

    // --- Task 2: Buyback and Burn ---
    console.log("\n--- Task 2: Executing Buyback ---");
    // Check if buyback is triggerable
    // Tokens to check: [USDT, USDC] (Add real addresses for production)
    // For Testnet, we might only have Mock tokens or BNB.
    // Let's check Native (BNB) first.
    
    const tokensToCheck = []; // Add ERC20 addresses here if needed
    const includeNative = true;

    try {
        const [totalUsd, isTriggerable] = await feeCollector.checkUpside(tokensToCheck, includeNative);
        console.log(`FeeCollector Stats:`);
        console.log(`- Total Value: $${ethers.formatUnits(totalUsd, 18)}`);
        console.log(`- Threshold Met: ${isTriggerable}`);

        if (isTriggerable) {
            console.log("Threshold met! Executing BuybackAndBurn...");
            // Min BFR out amounts (slippage protection). For now set to 0 for simplicity.
            const minBfrOuts = tokensToCheck.map(() => 0); 
            
            const tx = await feeCollector.executeBuybackAndBurn(tokensToCheck, minBfrOuts, includeNative);
            console.log(`- Buyback tx sent: ${tx.hash}`);
            await tx.wait();
            console.log("- Buyback executed successfully!");
        } else {
            console.log("Threshold not met. Skipping buyback.");
        }
    } catch (err) {
        console.error("Error during buyback check:", err.message);
    }

    console.log("\nDaily Maintenance Completed.");
}

// Schedule the task
// Cron syntax: "0 0 * * *" = At 00:00 every day
console.log("Scheduler started. Waiting for 00:00 daily trigger...");
cron.schedule("0 0 * * *", () => {
    main().catch((error) => {
        console.error("Script execution failed:", error);
    });
});

// For immediate testing (uncomment to run once immediately)
// main();
