const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    console.log("正在恢复 BNB 的预言机配置...");
    
    // 1. 部署新的 Mock Aggregator (价格 $600)
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const agg = await MockAggregator.deploy(8, 60000000000n); // $600 * 10^8
    await agg.waitForDeployment();
    const aggAddr = await agg.getAddress();
    console.log(`新的 MockAggregator 已部署: ${aggAddr}`);

    // 2. 设置回去
    const tx = await escrow.setTokenPriceFeed(ethers.ZeroAddress, aggAddr);
    await tx.wait();
    
    console.log("✅ 恢复成功！BNB 交易应恢复正常。");
}

main().catch(console.error);
