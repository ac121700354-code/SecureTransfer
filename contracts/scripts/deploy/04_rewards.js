const { ethers } = require("hardhat");
const { saveDeployment, getDeployedAddress } = require("../utils");

async function main() {
    console.log(`\n--- 04. Deploying ActivityRewards ---`);
    
    const bufferToken = getDeployedAddress("BufferToken");
    const escrow = getDeployedAddress("EscrowProxy");

    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    const rewards = await ActivityRewards.deploy(bufferToken, escrow);
    await rewards.waitForDeployment();

    const address = await rewards.getAddress();
    console.log(`✅ ActivityRewards deployed at: ${address}`);
    saveDeployment("ActivityRewards", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
