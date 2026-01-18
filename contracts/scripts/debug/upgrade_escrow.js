const { ethers, upgrades } = require("hardhat");

async function main() {
    const proxyAddress = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    console.log("Upgrading Escrow at:", proxyAddress);

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    
    // Upgrade
    const upgraded = await upgrades.upgradeProxy(proxyAddress, Escrow);
    await upgraded.waitForDeployment();

    console.log("Escrow upgraded successfully!");
}

main().catch(console.error);
