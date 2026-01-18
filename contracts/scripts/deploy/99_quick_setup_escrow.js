const { ethers } = require("hardhat");
const { getDeployedAddress } = require("../utils");

async function main() {
    console.log(`\n--- Quick Setup for Escrow ---`);
    
    // 1. Get Escrow
    const escrowAddr = getDeployedAddress("EscrowProxy");
    console.log(`Target Escrow: ${escrowAddr}`);
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddr);

    // 2. Deploy Mock Aggregator (BNB Price $600)
    console.log("Deploying MockAggregator...");
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const agg = await MockAggregator.deploy(8, 60000000000n); // $600 * 10^8
    await agg.waitForDeployment();
    const aggAddr = await agg.getAddress();
    console.log(`MockAggregator deployed at: ${aggAddr}`);

    // 3. Set Price Feed for Native Token (BNB)
    console.log("Setting Token Price Feed...");
    const tx = await escrow.setTokenPriceFeed(ethers.ZeroAddress, aggAddr);
    await tx.wait();
    console.log("✅ Price Feed Set for Native Token");

    // 4. Set Fee BPS (Optional, default is 1 = 0.01%)
    // await (await escrow.setFeeBps(10)).wait(); // Set to 0.1% if needed
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
