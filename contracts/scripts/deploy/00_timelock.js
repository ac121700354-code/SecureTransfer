const { ethers, network } = require("hardhat");
const { saveDeployment } = require("../utils");

async function main() {
    console.log(`\n--- 00. Deploying Timelock ---`);
    const [deployer] = await ethers.getSigners();

    // Mainnet: 24h, Testnet: 60s
    const isTestnet = network.name !== "bnb_mainnet" && network.name !== "ethereum";
    const minDelay = isTestnet ? 60 : 86400; 

    console.log(`Delay: ${minDelay} seconds`);

    const Timelock = await ethers.getContractFactory("Timelock");
    const timelock = await Timelock.deploy(
        minDelay,
        [deployer.address], // Proposers
        [ethers.ZeroAddress], // Executors
        deployer.address // Admin
    );
    await timelock.waitForDeployment();
    
    const address = await timelock.getAddress();
    console.log(`✅ Timelock deployed at: ${address}`);
    saveDeployment("Timelock", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
