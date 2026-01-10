const { ethers } = require("hardhat");

async function main() {
    const activityRewardsAddress = "0xD872BdC7B66231f8eDcB7039c2cA3144977Dcc13";
    const tokenAddress = "0x73Ed01D39408bC5A582896a6F69d6193e7017Af7"; // HK Token

    console.log("Checking ActivityRewards Balance...");

    const token = await ethers.getContractAt("BufferToken", tokenAddress);
    const balance = await token.balanceOf(activityRewardsAddress);

    console.log(`Contract: ${activityRewardsAddress}`);
    console.log(`Balance: ${ethers.formatUnits(balance, 18)} HK`);

    if (balance > 0n) {
        console.log("SUCCESS: Contract is funded!");
    } else {
        console.log("WARNING: Contract balance is 0. Rewards will fail.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
