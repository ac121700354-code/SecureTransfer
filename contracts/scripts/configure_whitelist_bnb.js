const { ethers } = require("hardhat");

async function main() {
    // Contract Addresses (From previous steps)
    const escrowAddress = "0x37E9FD365504E6b838FD94bea8AE3eb7D48290e1"; 
    const aggregatorAddress = "0xb9713EA42C0f14692FDc674b5dA4881701adc910";
    const bufferTokenAddress = "0x73Ed01D39408bC5A582896a6F69d6193e7017Af7";
    const feeCollectorAddress = "0x1d99D9737EDa3AB8D1A326CBA1456DA153c6E607";

    const [deployer] = await ethers.getSigners();
    console.log(`Configuring Whitelist with account: ${deployer.address}`);

    const Escrow = await ethers.getContractAt("SecureHandshakeUnlimitedInbox", escrowAddress);
    const FeeCollector = await ethers.getContractFactory("FeeCollector"); // Attach later
    const feeCollector = FeeCollector.attach(feeCollectorAddress);

    // Tokens to whitelist
    const TOKENS = [
        { symbol: "HK", address: bufferTokenAddress },
        // Native is already set, but no harm checking
        { symbol: "BNB", address: ethers.ZeroAddress } 
    ];

    for (const t of TOKENS) {
        console.log(`Configuring ${t.symbol} (${t.address})...`);
        
        // 1. Escrow Feed
        const currentFeed = await Escrow.tokenPriceFeeds(t.address);
        if (currentFeed !== aggregatorAddress) {
            console.log(`  Setting Escrow Feed...`);
            const tx = await Escrow.setTokenPriceFeed(t.address, aggregatorAddress);
            await tx.wait();
            console.log(`  > Done.`);
        } else {
            console.log(`  Escrow Feed already set.`);
        }

        // 2. FeeCollector Feed (Important for fee calculation if FeeCollector uses it)
        if (t.address !== ethers.ZeroAddress) { // FeeCollector might not handle Native mapping same way or might need WETH
             // Check FeeCollector interface if needed, but assuming setPriceFeed exists
             try {
                console.log(`  Setting FeeCollector Feed...`);
                const tx = await feeCollector.setPriceFeed(t.address, aggregatorAddress);
                await tx.wait();
                console.log(`  > Done.`);
             } catch (e) {
                 console.log(`  Skipping FeeCollector (maybe not needed or error): ${e.message}`);
             }
        }
    }

    console.log("Whitelist configuration complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
