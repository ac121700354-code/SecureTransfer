const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);
    const [deployer] = await ethers.getSigners();

    console.log(`Using account: ${deployer.address}`);

    // 1. Create a new order
    console.log("Initiating transfer...");
    const amount = ethers.parseEther("0.01"); // Increase to $6
    // Send to self to simplify
    const tx = await escrow.initiate(ethers.ZeroAddress, deployer.address, amount, { value: amount });
    const receipt = await tx.wait();
    
    // Parse logs to get ID
    const log = receipt.logs.find(l => {
        try { return escrow.interface.parseLog(l)?.name === "TransferInitiated"; } 
        catch { return false; }
    });
    const id = escrow.interface.parseLog(log).args.id;
    console.log(`Created Order ID: ${id}`);

    // 2. Check outbox
    let ids = await escrow.getOutboxIds(deployer.address);
    console.log("Outbox IDs after create:", ids.length);
    if (!ids.includes(id)) console.error("❌ ID not found in Outbox!");

    // 3. Cancel order
    console.log("Cancelling order...");
    const tx2 = await escrow.cancel(id);
    await tx2.wait();
    console.log("Cancelled.");

    // 4. Check outbox again
    ids = await escrow.getOutboxIds(deployer.address);
    console.log("Outbox IDs after cancel:", ids.length);
    if (ids.includes(id)) {
        console.error("❌ ID STILL in Outbox (Zombie)!");
        // Check details
        const details = await escrow.activeTransfers(id);
        console.log("Details sender:", details.sender);
    } else {
        console.log("✅ ID removed from Outbox.");
    }
}

main().catch(console.error);
