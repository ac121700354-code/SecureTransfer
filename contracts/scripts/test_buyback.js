const { ethers, network } = require("hardhat");
const { getDeployedAddress } = require("./utils");
require("dotenv").config();

async function main() {
    console.log("🚀 Starting Buyback Test Script...");

    const [signer] = await ethers.getSigners();
    console.log(`Connected with: ${signer.address}`);

    const feeCollectorAddress = getDeployedAddress("FeeCollector");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(signer);

    // 1. 设置 BNB 的 Mock 价格 (如果是在测试网)
    // FeeCollector 需要知道 WBNB 的价格才能计算 checkUpside
    const wethAddress = await feeCollector.weth();
    console.log(`WETH/WBNB Address: ${wethAddress}`);

    // 如果是本地测试，我们可能需要部署一个新的 MockAggregator
    // 或者直接使用已经部署好的
    let mockAggregatorAddress;
    try {
        mockAggregatorAddress = getDeployedAddress("MockAggregator");
    } catch {
        console.log("MockAggregator not found, deploying new one...");
        const MockAggregator = await ethers.getContractFactory("MockAggregator");
        const agg = await MockAggregator.deploy(8, 30000000000n); // $300
        await agg.waitForDeployment();
        mockAggregatorAddress = await agg.getAddress();
    }

    // 设置 WETH 的价格
    console.log("Setting WBNB Price Feed...");
    await (await feeCollector.setPriceFeed(wethAddress, mockAggregatorAddress)).wait();
    // 同时也设置 Native (0x0) 的价格，以防万一
    await (await feeCollector.setPriceFeed(ethers.ZeroAddress, mockAggregatorAddress)).wait();

    // 2. 模拟收入 (0.01 BNB)
    console.log("\n💰 Simulating Fee Income...");
    const depositAmount = ethers.parseEther("0.01");
    await (await signer.sendTransaction({
        to: feeCollectorAddress,
        value: depositAmount
    })).wait();
    console.log(`Deposited ${ethers.formatEther(depositAmount)} BNB`);

    // 3. 降低回购门槛 ($1)
    console.log("\n📉 Lowering Buyback Threshold...");
    const newThreshold = ethers.parseEther("1"); // $1
    await (await feeCollector.setBuybackThreshold(newThreshold)).wait();
    
    // 开启回购
    await (await feeCollector.setBuybackEnabled(true)).wait();
    console.log(`Threshold lowered to $1 & Buyback Enabled`);

    // 4. 执行回购
    console.log("\n🔥 Executing Buyback...");
    const tokensToCheck = []; // 只有 BNB
    const includeNative = true;
    
    try {
        const [totalUsd, isTriggerable] = await feeCollector.checkUpside(tokensToCheck, includeNative);
        console.log(`Current Value: $${ethers.formatUnits(totalUsd, 18)}`);
        
        if (isTriggerable) {
            console.log("Threshold met! Executing...");
            
            // New signature: (tokens, minOuts, minFromNative, includeNative)
            const tx = await feeCollector.executeBuybackAndBurn(
                tokensToCheck, 
                [], 
                0, // minBfrFromNative (slippage 100%)
                includeNative
            );
            console.log(`Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log("✅ Buyback executed successfully!");
        } else {
            console.log("❌ Threshold not met (Unexpected).");
        }
    } catch (err) {
        console.error("❌ Buyback failed:", err.message);
        if (err.message.includes("TRANSFER_FROM_FAILED")) {
            console.error("Possible cause: Liquidity pool missing or transfer tax issue.");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
