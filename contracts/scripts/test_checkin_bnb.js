const { ethers } = require("hardhat");

async function main() {
    const activityRewardsAddress = "0xD872BdC7B66231f8eDcB7039c2cA3144977Dcc13";
    const ActivityRewards = await ethers.getContractAt("ActivityRewards", activityRewardsAddress);

    const [signer] = await ethers.getSigners();
    console.log(`Testing Check-in with account: ${signer.address}`);

    // Check current status
    const infoBefore = await ActivityRewards.userCheckIns(signer.address);
    console.log(`Current Streak: ${infoBefore.streak}`);
    console.log(`Last Check-in: ${new Date(Number(infoBefore.lastCheckInTime) * 1000).toLocaleString()}`);

    try {
        console.log("Attempting to check in...");
        const tx = await ActivityRewards.checkIn();
        console.log(`Tx sent: ${tx.hash}`);
        await tx.wait();
        console.log("Check-in successful!");
        
        const infoAfter = await ActivityRewards.userCheckIns(signer.address);
        console.log(`New Streak: ${infoAfter.streak}`);
    } catch (error) {
        if (error.message.includes("Already checked in today")) {
            console.log("✅ Already checked in today. Contract logic is working.");
        } else {
            console.error("❌ Check-in failed:", error.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
