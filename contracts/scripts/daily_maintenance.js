const { ethers, network } = require("hardhat");
const cron = require("node-cron");
const { getDeployedAddress } = require("./utils");
require("dotenv").config();

// Configuration
// Mainnet: 7 days (604800s), Testnet: 5 mins (300s) for testing
const EXPIRE_DURATION = network.name === "bnb_mainnet" ? 604800 : 300; 

async function main() {
    console.log(`\n=== Starting Maintenance Script [${new Date().toISOString()}] ===`);
    console.log(`Network: ${network.name}`);
    
    const [maintainer] = await ethers.getSigners();
    console.log(`Maintainer: ${maintainer.address}`);

    // Load Contracts
    const escrowAddress = getDeployedAddress("EscrowProxy");
    const feeCollectorAddress = getDeployedAddress("FeeCollector");

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress).connect(maintainer);

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(maintainer);

    // --- Task 1: Clean Expired Transfers ---
    console.log("\n--- Task 1: Checking for Expired Transfers ---");
    
    // Scan events from last 14 days to catch any lingering orders
    const currentBlock = await ethers.provider.getBlockNumber();
    const blocksPerDay = 28800; // BSC: ~3s block time
    const lookbackBlocks = blocksPerDay * 14; 
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
    
    console.log(`Scanning blocks: ${fromBlock} -> ${currentBlock}`);
    
    const filter = escrow.filters.TransferInitiated();
    const events = await escrow.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} transfer events in range.`);

    const expiredIds = [];
    const now = Math.floor(Date.now() / 1000);

    for (const event of events) {
        const id = event.args[0];
        try {
            const record = await escrow.activeTransfers(id);
            
            // Check if record is still active (receiver != 0)
            if (record.receiver !== ethers.ZeroAddress) {
                const createdAt = Number(record.createdAt);
                
                // Check expiration
                if (now > createdAt + EXPIRE_DURATION) {
                    console.log(`Found Expired: ${id}`);
                    console.log(`- Created: ${new Date(createdAt * 1000).toISOString()}`);
                    console.log(`- Age: ${((now - createdAt) / 3600).toFixed(1)} hours`);
                    expiredIds.push(id);
                }
            }
        } catch (err) {
            console.error(`Error checking ID ${id}:`, err.message);
        }
    }

    if (expiredIds.length > 0) {
        console.log(`\nExecuting Batch Expiration for ${expiredIds.length} orders...`);
        try {
            // Batch process (max 20 per tx to be safe with gas)
            const BATCH_SIZE = 20;
            for (let i = 0; i < expiredIds.length; i += BATCH_SIZE) {
                const batch = expiredIds.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${i/BATCH_SIZE + 1}...`);
                
                const tx = await escrow.forceExpireBatch(batch);
                console.log(`- Tx Sent: ${tx.hash}`);
                await tx.wait();
                console.log(`- Batch Confirmed!`);
            }
        } catch (err) {
            console.error("Batch expiration failed:", err.message);
        }
    } else {
        console.log("No expired orders found.");
    }

    // --- Task 2: Buyback and Burn ---
    console.log("\n--- Task 2: Executing Buyback ---");
    
    const tokensToCheck = []; // Add specific tokens if needed (e.g. USDT)
    const includeNative = true;

    try {
        const [totalUsd, isTriggerable] = await feeCollector.checkUpside(tokensToCheck, includeNative);
        console.log(`FeeCollector Value: $${ethers.formatUnits(totalUsd, 18)}`);

        if (isTriggerable) {
            console.log("Threshold met! Executing Buyback...");
            const tx = await feeCollector.executeBuybackAndBurn(
                tokensToCheck, 
                [], // minOuts
                0,  // minFromNative
                includeNative
            );
            console.log(`- Buyback Tx: ${tx.hash}`);
            await tx.wait();
            console.log("- Success!");
        } else {
            console.log("Threshold not met.");
        }
    } catch (err) {
        console.error("Buyback check failed:", err.message);
    }

    console.log("\n=== Maintenance Completed ===");
}

// Check if run directly or imported
if (require.main === module) {
    // If run directly: "npx hardhat run scripts/daily_maintenance.js"
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
} else {
    // If imported by scheduler/server
    module.exports = main;
}
