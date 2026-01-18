
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deployment = JSON.parse(fs.readFileSync("deployment-testnet.json"));
    const escrowAddress = deployment.escrow;
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    const sender = "0x31DB01c2553F466812f7f16d2B9900e4b2fcbe4F";
    const nativeToken = ethers.ZeroAddress;

    console.log("Checking Escrow Contract at:", escrowAddress);
    console.log("Sender:", sender);

    // 1. Check Token Whitelist (Native)
    const feed = await escrow.tokenPriceFeeds(nativeToken);
    console.log("Native Token Price Feed:", feed);
    if (feed === ethers.ZeroAddress) {
        console.error("ERROR: Native Token is NOT whitelisted!");
    } else {
        // Check Oracle Data
        try {
            const AggregatorV3 = await ethers.getContractFactory("MockAggregator"); // Use Mock artifact for interface
            const priceFeed = AggregatorV3.attach(feed);
            const roundData = await priceFeed.latestRoundData();
            console.log("Oracle Price:", roundData[1].toString());
            console.log("Oracle UpdatedAt:", roundData[3].toString());
            
            const heartbeat = await escrow.oracleHeartbeat();
            const now = Math.floor(Date.now() / 1000);
            if (now - Number(roundData[3]) > Number(heartbeat)) {
                 console.error("ERROR: Oracle Price Expired!");
            }
        } catch (e) {
            console.error("ERROR: Failed to fetch oracle data", e.message);
        }
    }

    // 2. Check Outbox Limit
    const outboxCount = await escrow.getOutboxCount(sender);
    const maxOutbox = await escrow.maxPendingOutbox();
    console.log(`Sender Outbox: ${outboxCount} / ${maxOutbox}`);
    
    if (outboxCount >= maxOutbox) {
        console.error("ERROR: Sender Outbox is FULL!");
    }

    // 3. Check Fee Params
    const feeBps = await escrow.feeBps();
    console.log("Fee BPS:", feeBps.toString());

    // 4. Try to estimate gas for a valid transaction to self (should fail) and valid to random (should succeed)
    // We can't easily simulate the exact failed tx without knowing the receiver and amount.
    // But we can check if the basic checks pass.
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
