const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    console.log("正在移除 BNB 的预言机配置 (模拟 TokenNotWhitelisted/PriceFeedNotSet)...");
    // 设置 BNB (address(0)) 的 Price Feed 为 0 地址
    const tx = await escrow.setTokenPriceFeed(ethers.ZeroAddress, ethers.ZeroAddress);
    await tx.wait();
    
    console.log("✅ 修改成功！现在发起 BNB 交易应该会报错。");
}

main().catch(console.error);
