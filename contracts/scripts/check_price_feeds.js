const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // 1. 读取部署信息
    const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ Deployment file not found:", deploymentPath);
        return;
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    // FIX: deployment-testnet.json uses lowercase "escrow" key
    const escrowAddress = deployment.escrow || deployment.SecureHandshakeUnlimitedInbox;

    if (!escrowAddress) {
        console.error("❌ Escrow contract address not found in deployment file.");
        return;
    }

    console.log("🔍 Checking Price Feeds on Escrow Contract:", escrowAddress);

    // 2. 连接合约
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    // 3. 定义我们要检查的 Token
    const TOKENS = [
        { symbol: "BNB", address: ethers.ZeroAddress }, // Native
        // 如果有其他 ERC20，也可以加在这里
        // { symbol: "USDT", address: "..." }
    ];

    // 4. 遍历检查
    for (const token of TOKENS) {
        console.log(`\nChecking ${token.symbol} (${token.address})...`);
        try {
            const feedAddress = await escrow.tokenPriceFeeds(token.address);
            console.log(`   Feed Address: ${feedAddress}`);

            if (feedAddress === ethers.ZeroAddress) {
                console.warn(`   ⚠️ No price feed configured for ${token.symbol}!`);
                continue;
            }

            // 检查 Feed 是否有数据
            const AggregatorV3Interface = [
                "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
                "function decimals() view returns (uint8)",
                "function description() view returns (string)"
            ];
            const feed = new ethers.Contract(feedAddress, AggregatorV3Interface, ethers.provider);

            const decimals = await feed.decimals();
            const description = await feed.description();
            const roundData = await feed.latestRoundData();
            const price = roundData[1];

            console.log(`   Feed Description: ${description}`);
            console.log(`   Decimals: ${decimals}`);
            console.log(`   Raw Price: ${price.toString()}`);
            console.log(`   Formatted Price: ${ethers.formatUnits(price, decimals)}`);

        } catch (error) {
            console.error(`   ❌ Error checking feed:`, error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
