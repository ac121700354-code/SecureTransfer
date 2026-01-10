const { ethers } = require("hardhat");

async function main() {
    // 目标地址
    const targetAddress = "0x31DB01c2553F466812f7f16d2B9900e4b2fcbe4F";
    // Token 地址 (HSK/STP on BNB Testnet)
    const tokenAddress = "0x1e540D666acdEda1c3Ca3f98675A34f3F9756aA8"; 
    
    // 要发送的数量 (例如 10,000 STP)
    const amount = ethers.parseUnits("10000", 18);

    const [sender] = await ethers.getSigners();
    console.log(`Sending tokens from ${sender.address} to ${targetAddress}...`);

    const token = await ethers.getContractAt("BufferToken", tokenAddress);
    
    // 检查余额
    const balance = await token.balanceOf(sender.address);
    console.log(`Current Balance: ${ethers.formatUnits(balance, 18)} STP`);

    if (balance < amount) {
        console.error("Insufficient balance!");
        return;
    }

    const tx = await token.transfer(targetAddress, amount);
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    
    console.log("Transfer success!");
    
    // 验证新余额
    const newBalance = await token.balanceOf(targetAddress);
    console.log(`Target Address Balance: ${ethers.formatUnits(newBalance, 18)} STP`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
