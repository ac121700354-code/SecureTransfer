const { ethers, network } = require("hardhat");
const { saveDeployment, getDeployedAddress } = require("../utils");
require("dotenv").config();
const networkConfig = require("../../network-config.js");

async function main() {
    console.log(`\n--- 02. Deploying FeeCollector ---`);
    const [deployer] = await ethers.getSigners();
    
    const bufferToken = getDeployedAddress("BufferToken");
    
    // Config
    const netConfig = networkConfig[network.name] || {};
    const router = netConfig.router || "0x0000000000000000000000000000000000000000";
    const weth = netConfig.weth || "0x0000000000000000000000000000000000000000";
    const treasury = process.env.DAO_WALLET || deployer.address;

    console.log(`Router: ${router}`);
    console.log(`Treasury: ${treasury}`);

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const collector = await FeeCollector.deploy(
        bufferToken,
        router,
        weth,
        treasury
    );
    await collector.waitForDeployment();

    const address = await collector.getAddress();
    console.log(`✅ FeeCollector deployed at: ${address}`);
    saveDeployment("FeeCollector", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
