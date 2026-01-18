const { ethers } = require("hardhat");

async function main() {
    const ESCROW_ADDRESS = "0x47279Feb982EE60C080C6255C50791Ed4F4AC0AA"; // 最新部署的地址
    const [deployer] = await ethers.getSigners();
    
    console.log("诊断开始...");
    console.log("使用账户:", deployer.address);
    console.log("合约地址:", ESCROW_ADDRESS);

    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(ESCROW_ADDRESS);

    // 1. 检查 Treasury 设置
    try {
        const treasury = await escrow.treasury();
        console.log("Treasury 地址:", treasury);
        if (treasury === ethers.ZeroAddress) {
            console.error("❌ 错误: Treasury 未设置 (合约可能未初始化)");
        }
    } catch (e) {
        console.error("❌ 读取 Treasury 失败:", e.message);
    }

    // 2. 检查 BNB 预言机配置
    try {
        const feed = await escrow.tokenPriceFeeds(ethers.ZeroAddress);
        console.log("BNB Price Feed:", feed);
        
        if (feed === ethers.ZeroAddress) {
            console.error("❌ 错误: BNB 预言机未配置");
        } else {
            // 检查预言机数据
            const Aggregator = await ethers.getContractFactory("MockAggregator");
            const agg = Aggregator.attach(feed);
            const round = await agg.latestRoundData();
            console.log("预言机数据:");
            console.log("  Price:", round[1].toString());
            console.log("  UpdatedAt:", round[3].toString());
            
            const now = Math.floor(Date.now() / 1000);
            const diff = now - Number(round[3]);
            console.log("  当前时间:", now);
            console.log("  时间差 (秒):", diff);
            
            if (diff > 3600 * 24) { // 假设默认心跳 24h
                console.error("❌ 错误: 预言机价格已过期");
            }
        }
    } catch (e) {
        console.error("❌ 读取预言机失败:", e.message);
    }

    // 3. 模拟 initiate 交易
    console.log("\n尝试模拟 initiate (1 BNB)...");
    try {
        // 使用 callStatic 模拟执行
        const tx = await escrow.initiate.staticCall(
            ethers.ZeroAddress, // Token (BNB)
            deployer.address,   // Receiver (自己转自己测试)
            ethers.parseEther("1.0"), // Amount
            { value: ethers.parseEther("1.0") } // msg.value
        );
        console.log("✅ 模拟执行成功! 返回 ID:", tx);
    } catch (e) {
        console.error("❌ 模拟执行失败!");
        // 尝试解析错误
        if (e.data) {
            const decoded = escrow.interface.parseError(e.data);
            console.error("解析到的 Custom Error:", decoded ? decoded.name : "无法解析");
            if (decoded) console.error("参数:", decoded.args);
        } else {
            console.error("原始错误:", e.message);
        }
    }
}

main().catch(console.error);
