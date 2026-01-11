const { ethers, upgrades } = require("hardhat");
const { saveDeployment, getDeployedAddress } = require("../utils");

async function main() {
    console.log(`\n--- 03. Deploying Escrow (UUPS) ---`);
    
    const feeCollector = getDeployedAddress("FeeCollector");

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    
    // Deploy Proxy
    const escrow = await upgrades.deployProxy(Escrow, [feeCollector], { 
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
