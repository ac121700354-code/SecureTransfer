const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4"; // 当前合约
    
    console.log("正在修改 BNB 心跳为 1 小时 (3600s)...");
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    // 设置 BNB (address(0)) 的心跳为 600 秒
    const tx = await escrow.setTokenHeartbeat(ethers.ZeroAddress, 600);
    await tx.wait();
    
    console.log("✅ 修改成功！现在发起交易应该会报错 OraclePriceExpired。");
}

main().catch(console.error);
