const { ethers } = require("hardhat");

async function main() {
    const escrowAddress = "0x7Fc201E821FA66E17095e2366E05F75860ee9Cd3";
    const feeCollectorAddress = "0x7b034d6A09eB4B8369A61C00a1eB6836A22D51E3";
    const aggregatorAddress = "0x4a18DDE21f7Dc36db51892Bc1c2c1D51490179d3";
    const btcAddress = "0xF3e89B53528f98E142649a22d14562FebdFFf86B";

    const [deployer] = await ethers.getSigners();
    console.log(`Configuring whitelist with account: ${deployer.address}`);

    // 1. Configure Escrow
    console.log("Configuring EscrowProxy...");
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    try {
        const tx1 = await escrow.setTokenPriceFeed(btcAddress, aggregatorAddress);
        console.log("Tx sent: setTokenPriceFeed on Escrow");
        await tx1.wait();
        console.log("Escrow Whitelisted BTC successfully");
    } catch (e) {
        console.error("Escrow configuration failed:", e.message);
    }

    // 2. Configure FeeCollector
    console.log("Configuring FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress);

    try {
        const tx2 = await feeCollector.setPriceFeed(btcAddress, aggregatorAddress);
        console.log("Tx sent: setPriceFeed on FeeCollector");
        await tx2.wait();
        console.log("FeeCollector Whitelisted BTC successfully");
    } catch (e) {
        console.error("FeeCollector configuration failed:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
