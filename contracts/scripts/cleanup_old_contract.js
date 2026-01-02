const { ethers } = require("hardhat");
require("dotenv").config();

// 旧合约地址 (Deployment 1)
const OLD_ESCROW_ADDRESS = "0xb6422f04579872B75e1E1D88c016E3589014FAFC";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function main() {
    console.log("Starting Cleanup for OLD Escrow Contract...");
    console.log(`Target Address: ${OLD_ESCROW_ADDRESS}`);

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with: ${wallet.address}`);

    // Attach to Old Contract
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(OLD_ESCROW_ADDRESS).connect(wallet);

    // 1. Get Outbox (Orders sent by me)
    console.log("Fetching pending orders...");
    const outboxIds = await escrow.getOutboxIds(wallet.address);
    console.log(`Found ${outboxIds.length} orders in outbox.`);

    if (outboxIds.length === 0) {
        console.log("No orders to cancel.");
        return;
    }

    // 2. Loop and Cancel
    for (const id of outboxIds) {
        try {
            console.log(`\nProcessing Order ID: ${id}`);
            const details = await escrow.activeTransfers(id);
            
            // Check if active (receiver != 0)
            if (details.receiver === ethers.ZeroAddress) {
                console.log("- Already settled/cancelled.");
                continue;
            }

            console.log(`- Amount: ${ethers.formatEther(details.amount)}`);
            console.log(`- Token: ${details.token}`);
            
            // Execute Cancel
            console.log("- Cancelling...");
            const tx = await escrow.cancel(id);
            console.log(`- Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log("- Cancelled Successfully!");
            
        } catch (err) {
            console.error(`- Failed to cancel: ${err.reason || err.message}`);
        }
    }

    console.log("\nCleanup Completed.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
