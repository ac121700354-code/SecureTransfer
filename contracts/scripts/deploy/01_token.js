const { ethers, network } = require("hardhat");
const { saveDeployment, getDeployedAddress } = require("../utils");

async function main() {
    console.log(`\n--- 01. Deploying BufferToken ---`);
    const [deployer] = await ethers.getSigners();
    
    const timelockAddress = getDeployedAddress("Timelock");
    const isTestnet = network.name !== "bnb_mainnet" && network.name !== "ethereum";
    
    // Testnet: 10M, Mainnet: 1B
    const supply = ethers.parseUnits(isTestnet ? "10000000" : "1000000000", 18);

    const BufferToken = await ethers.getContractFactory("BufferToken");
    const token = await BufferToken.deploy(
        deployer.address, // Initial Admin
        timelockAddress,  // Timelock (Minter/Pauser)
        supply
    );
    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log(`✅ BufferToken deployed at: ${address}`);
    saveDeployment("BufferToken", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
