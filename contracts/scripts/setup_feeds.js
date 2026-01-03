const { ethers, network } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Setting up feeds with account: ${deployer.address}`);

    // Addresses from previous successful run
    const bufferTokenAddress = "0x1e540D666acdEda1c3Ca3f98675A34f3F9756aA8";
    const feeCollectorAddress = "0x44c7897dB367C1c3F7815187970349362416C5B8";
    const escrowAddress = "0x913B3CC3449921384C227d48940eC8C8FC4E53ac";
    const aggregatorAddress = "0x2e8e6409d092dB73FF18A3d1C61418E534A3a990";

    const EscrowProxy = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");

    const escrowContract = EscrowProxy.attach(escrowAddress).connect(deployer);
    const feeCollectorContract = FeeCollector.attach(feeCollectorAddress).connect(deployer);

    // 1. Set Native Token Feed
    console.log("Setting Native Token Feed...");
    try {
        let tx = await escrowContract.setTokenPriceFeed(ethers.ZeroAddress, aggregatorAddress);
        await tx.wait();
        console.log("  - Escrow Native Feed Set");
    } catch (e) { console.log("  - Escrow Native Feed Skip/Error:", e.message); }

    // 2. Whitelist Tokens
    const TOKENS = [
        { symbol: "BNB", address: ethers.ZeroAddress },
        { symbol: "STP", address: bufferTokenAddress },
        // Add common testnet tokens if needed, but for now STP is key
    ];

    for (const t of TOKENS) {
        console.log(`Configuring ${t.symbol}...`);
        try {
            if (t.address !== ethers.ZeroAddress) {
                let tx = await escrowContract.setTokenPriceFeed(t.address, aggregatorAddress);
                await tx.wait();
                console.log("  - Escrow Feed Set");
            }
            
            let tx2 = await feeCollectorContract.setPriceFeed(t.address, aggregatorAddress);
            await tx2.wait();
            console.log("  - FeeCollector Feed Set");
        } catch (e) {
            console.log(`  - Error: ${e.message}`);
        }
    }

    console.log("Done!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});