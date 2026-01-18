const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4"; 
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    // 1. 检查心跳配置
    const hb = await escrow.tokenHeartbeats(ethers.ZeroAddress);
    console.log("BNB Heartbeat Config:", hb.toString(), "seconds");

    // 2. 检查预言机数据
    const feed = await escrow.tokenPriceFeeds(ethers.ZeroAddress);
    const Aggregator = await ethers.getContractFactory("MockAggregator");
    const agg = Aggregator.attach(feed);
    const round = await agg.latestRoundData();
    
    const now = Math.floor(Date.now() / 1000);
    const updatedAt = Number(round[3]);
    const diff = now - updatedAt;
    
    console.log("Oracle UpdatedAt:", updatedAt);
    console.log("Current Time:", now);
    console.log("Diff:", diff, "seconds");
    
    if (diff >= Number(hb)) {
        console.log("❌ 预期状态: 应该报错 OraclePriceExpired (Diff >= Heartbeat)");
    } else {
        console.log("✅ 预期状态: 交易应该成功 (Diff < Heartbeat)");
    }
}

main().catch(console.error);
