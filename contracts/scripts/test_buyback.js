const { ethers } = require("hardhat");
const deployment = require("../deployment.json");
require("dotenv").config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function main() {
    console.log("Starting Buyback Test Script...");

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with: ${wallet.address}`);

    const escrowAddress = deployment.contracts.EscrowProxy;
    const feeCollectorAddress = deployment.contracts.FeeCollector;
    const bufferTokenAddress = deployment.contracts.BufferToken;

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = FeeCollector.attach(feeCollectorAddress).connect(wallet);

    // 1. 设置 BNB 的 Mock 价格
    // checkUpside 函数需要计算 BNB 的美元价值，所以需要给 WETH (BNB) 设置预言机
    // 我们复用之前部署的 $100 MockAggregator，或者用 deployment.json 里的
    
    // 获取 WETH 地址 (在 BSC Testnet 上通常是 WBNB)
    // FeeCollector 构造函数里存了 weth 地址，我们读取一下
    const wethAddress = await feeCollector.weth();
    console.log(`WETH/WBNB Address in Collector: ${wethAddress}`);

    // 使用 deployment.json 里的 MockAggregator (之前部署的)
    // 或者为了稳妥，我们在这里重新部署一个 MockAggregator 并设置为 $300 (BNB price)
    console.log("\n1. Setting Mock Price for BNB to $300...");
    const mockBnbPrice = 30000000000n; // 300 * 10^8
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const mockBnbFeed = await MockAggregator.connect(wallet).deploy(8, mockBnbPrice);
    await mockBnbFeed.waitForDeployment();
    const mockBnbFeedAddress = await mockBnbFeed.getAddress();
    console.log(`BNB Mock Feed deployed at: ${mockBnbFeedAddress}`);

    // 设置 FeeCollector 的 WBNB 预言机
    console.log("Setting WBNB Price Feed in FeeCollector...");
    let tx = await feeCollector.setPriceFeed(wethAddress, mockBnbFeedAddress);
    await tx.wait();
    console.log("FeeCollector WBNB feed updated.");

    // 2. 模拟收入 (0.01 BNB)
    console.log("\n2. Simulating Fee Income...");
    const depositAmount = ethers.parseEther("0.01"); // 0.01 BNB
    tx = await wallet.sendTransaction({
        to: feeCollectorAddress,
        value: depositAmount
    });
    await tx.wait();
    console.log(`Deposited ${ethers.formatEther(depositAmount)} BNB to FeeCollector`);

    // 3. 降低回购门槛 ($1)
    console.log("\n3. Lowering Buyback Threshold...");
    const newThreshold = ethers.parseEther("1"); // $1
    tx = await feeCollector.setBuybackThreshold(newThreshold);
    await tx.wait();
    console.log(`Threshold lowered to $1`);

    // 4. 执行回购
    console.log("\n4. Checking Upside & Executing Buyback...");
    const tokensToCheck = []; // 只有 BNB
    const includeNative = true;
    
    try {
        const [totalUsd, isTriggerable] = await feeCollector.checkUpside(tokensToCheck, includeNative);
        console.log(`Current Value in Collector: $${ethers.formatUnits(totalUsd, 18)}`);
        
        if (isTriggerable) {
            console.log("Threshold met! Executing BuybackAndBurn...");
            // 由于我们已经添加了流动性 (1000 BFR + 0.1 BNB)
            // 理论上这次调用应该成功
            tx = await feeCollector.executeBuybackAndBurn(tokensToCheck, [], includeNative);
            console.log(`Buyback tx sent: ${tx.hash}`);
            await tx.wait();
            console.log("Buyback executed successfully!");
            
            // 检查余额变化
            const bfrBalance = await (await ethers.getContractAt("IERC20", bufferTokenAddress)).balanceOf(feeCollectorAddress);
            console.log(`FeeCollector BFR Balance (should be 0, burned): ${bfrBalance}`);
            
        } else {
            console.log("Threshold not met (Unexpected).");
        }
    } catch (err) {
        console.error("Buyback transaction failed:");
        // 解析错误原因
        if (err.data) {
             // 尝试 decode error
        }
        console.error(err.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
