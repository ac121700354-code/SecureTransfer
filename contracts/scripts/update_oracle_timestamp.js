const { ethers } = require("hardhat");
require("dotenv").config();

// HSK Token Address on BNB Testnet
const HSK_ADDRESS = "0x1e540D666acdEda1c3Ca3f98675A34f3F9756aA8";
// Escrow Proxy Address on BNB Testnet
const ESCROW_ADDRESS = "0x913B3CC3449921384C227d48940eC8C8FC4E53ac";

async function main() {
    console.log("Updating Oracle Timestamp...");

    const [deployer] = await ethers.getSigners();
    console.log("Signer:", deployer.address);

    // 1. Get Escrow Contract
    const Escrow = await ethers.getContractAt("SecureHandshakeUnlimitedInbox", ESCROW_ADDRESS);
    
    // 2. Get Price Feed Address for HSK
    console.log(`Checking price feed for HSK (${HSK_ADDRESS})...`);
    const feedAddress = await Escrow.tokenPriceFeeds(HSK_ADDRESS);
    console.log("Feed Address:", feedAddress);

    if (feedAddress === ethers.ZeroAddress) {
        console.error("Error: No price feed set for HSK token!");
        return;
    }

    // 3. Connect to MockAggregator
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const feed = MockAggregator.attach(feedAddress);

    // 4. Get Current Data
    const roundData = await feed.latestRoundData();
    const currentPrice = roundData[1];
    const updatedAt = roundData[3];
    
    console.log(`Current Price: ${currentPrice.toString()}`);
    console.log(`Last Updated: ${new Date(Number(updatedAt) * 1000).toLocaleString()}`);

    // 5. Update Answer (Refresh Timestamp)
    console.log("Updating answer to refresh timestamp...");
    const tx = await feed.updateAnswer(currentPrice);
    await tx.wait();

    console.log("✅ Oracle updated successfully!");
    
    // Verify
    const newRoundData = await feed.latestRoundData();
    console.log(`New Updated Time: ${new Date(Number(newRoundData[3]) * 1000).toLocaleString()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
