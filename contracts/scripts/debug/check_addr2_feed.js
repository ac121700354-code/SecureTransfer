const { ethers } = require("hardhat");

async function main() {
    const escrowAddress = "0x497589ab12326be34007FeeB66168C0CD85fC8e5"; // Address 2
    const usdtAddress = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    console.log("Checking price feed for USDT on Address 2...");
    const feedAddress = await escrow.tokenPriceFeeds(usdtAddress);
    console.log("Feed Address:", feedAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
