const { ethers, upgrades } = require("hardhat");
const { saveDeployment, getDeployedAddress } = require("../utils");

async function main() {
    console.log(`\n--- 03. Deploying Escrow (UUPS) ---`);
    
    // 如果想要手续费直接转给 DAO Wallet，而不是 FeeCollector
    // 可以在这里直接指定 DAO Wallet 地址
    // const feeCollector = getDeployedAddress("FeeCollector");
    const treasuryAddress = process.env.DAO_WALLET || "0x9d4eC3Db0F53d804e8cB2F53ADF7732bcB321287";

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    
    // Deploy Proxy
    const escrow = await upgrades.deployProxy(Escrow, [treasuryAddress], { 
        initializer: 'initialize',
        kind: 'uups'
    });
    await escrow.waitForDeployment();

    const address = await escrow.getAddress();
    console.log(`✅ Escrow Proxy deployed at: ${address}`);
    saveDeployment("EscrowProxy", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
