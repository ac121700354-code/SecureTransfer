const { ethers } = require("hardhat");

async function main() {
    const escrowAddress = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    console.log("Checking current fee parameters...");
    
    try {
        const minFee = await escrow.usdMinFee();
        const maxFee = await escrow.usdMaxFee();
        const threshold = await escrow.usdMinThreshold();
        const heartbeat = await escrow.defaultHeartbeat();

        console.log("USD Min Fee:", ethers.formatEther(minFee));
        console.log("USD Max Fee:", ethers.formatEther(maxFee));
        console.log("USD Min Threshold:", ethers.formatEther(threshold));
        console.log("Default Heartbeat:", heartbeat.toString());

        if (maxFee == 0n) {
            console.log("\n⚠️ WARNING: Max Fee is 0! Fees are effectively disabled.");
        }
    } catch (e) {
        console.error("Failed to read parameters (maybe contract not upgraded yet?):", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
