const { ethers } = require("hardhat");

async function main() {
    const escrowAddress = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const usdtAddress = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    console.log("Checking price feed for USDT...");
    const feedAddress = await escrow.tokenPriceFeeds(usdtAddress);
    console.log("Feed Address:", feedAddress);

    if (feedAddress === ethers.ZeroAddress) {
        console.error("No price feed set for USDT!");
        return;
    }

    const aggregatorAbi = [
        "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
        "function decimals() external view returns (uint8)"
    ];
    const feed = new ethers.Contract(feedAddress, aggregatorAbi, ethers.provider);

    try {
        const [roundId, answer, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
        const decimals = await feed.decimals();

        console.log("Price:", ethers.formatUnits(answer, decimals));
        console.log("UpdatedAt:", updatedAt.toString());
        
        const block = await ethers.provider.getBlock("latest");
        console.log("Current Block Timestamp:", block.timestamp);
        
        const diff = block.timestamp - Number(updatedAt);
        console.log("Time since update:", diff, "seconds");

        // Check heartbeat
        const heartbeat = await escrow.tokenHeartbeats(usdtAddress);
        const effectiveHeartbeat = heartbeat == 0 ? (24 * 3600) : heartbeat;
        console.log("Heartbeat:", effectiveHeartbeat.toString(), "seconds");

        if (diff >= effectiveHeartbeat) {
            console.error("ERROR: Oracle Price Expired!");
        } else {
            console.log("Oracle Price is valid.");
        }

    } catch (e) {
        console.error("Failed to fetch oracle data:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
