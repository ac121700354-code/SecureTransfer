const { ethers, upgrades } = require("hardhat");

async function main() {
    // EscrowProxy address on BNB Testnet
    const proxyAddress = "0xc47169416c9645F858ff9185Dd3950fad6A99694";

    console.log(`Upgrading Escrow at ${proxyAddress}...`);

    const EscrowV2 = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    
    // UUPS Upgrade
    const upgraded = await upgrades.upgradeProxy(proxyAddress, EscrowV2);
    await upgraded.waitForDeployment();

    console.log("Escrow upgraded successfully!");
    
    // Verify Implementation
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`New Implementation Address: ${implAddress}`);
    
    console.log("\nTo verify on BscScan:");
    console.log(`npx hardhat verify --network bnb_testnet ${implAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
