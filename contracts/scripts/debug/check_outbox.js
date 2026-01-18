const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4";
    const USER_ADDRESS = "0x31DB01c2553F466812f7f16d2B9900e4b2fcbe4F"; // From screenshot
    
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    console.log(`正在查询用户 ${USER_ADDRESS} 的 Outbox...`);
    
    try {
        const ids = await escrow.getOutboxIds(USER_ADDRESS);
        console.log(`Outbox IDs (${ids.length}):`, ids);

        for (const id of ids) {
            const order = await escrow.activeTransfers(id);
            // Check if deleted (sender == 0)
            if (order.sender === ethers.ZeroAddress) {
                console.log(`\nOrder ID: ${id} (已删除/无效)`);
                continue;
            }
            
            console.log(`\nOrder ID: ${id}`);
            console.log(`  Sender: ${order.sender}`);
            console.log(`  Receiver: ${order.receiver}`);
            console.log(`  Amount: ${ethers.formatUnits(order.amount, 18)}`);
            console.log(`  Total: ${ethers.formatUnits(order.totalAmount, 18)}`);
            console.log(`  Created: ${new Date(Number(order.createdAt) * 1000).toLocaleString()}`);
        }
    } catch (e) {
        console.error("查询失败:", e);
    }
}

main().catch(console.error);
