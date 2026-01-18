const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    console.log("正在重置 BNB 心跳为默认值 (0)...");
    const tx = await escrow.setTokenHeartbeat(ethers.ZeroAddress, 0);
    await tx.wait();
    
    console.log("✅ 重置成功！交易应恢复正常。");
}

main().catch(console.error);
