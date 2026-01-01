const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // --- 1. 部署 BufferToken ---
  console.log("\n1. Deploying BufferToken...");
  const BufferToken = await ethers.getContractFactory("BufferToken");
  // 构造函数传入 deployer 地址作为初始 Admin
  const bufferToken = await BufferToken.deploy(deployer.address);
  await bufferToken.waitForDeployment();
  const bufferTokenAddress = await bufferToken.getAddress();
  console.log("BufferToken deployed to:", bufferTokenAddress);

  // --- 2. 代币分发 (Token Distribution) ---
  console.log("\n2. Distributing Tokens...");
  
  // 定义分配额度 (基于 1 亿总量)
  const AMOUNT_TEAM = ethers.parseEther("15000000"); // 15%
  
  // 创建 Vesting 合约 (这里简化为直接转账给特定地址，实际应部署 TokenVesting 合约)
  // 确保地址有效，否则回退到 deployer
  let teamWallet = process.env.TEAM_WALLET;
  if (!teamWallet || !ethers.isAddress(teamWallet)) {
      console.log("Invalid or missing TEAM_WALLET in .env, using deployer address instead.");
      teamWallet = deployer.address;
  }
  
  // 模拟转账动作
  await (await bufferToken.transfer(teamWallet, AMOUNT_TEAM)).wait();
  console.log(`Transferred ${ethers.formatEther(AMOUNT_TEAM)} BFR to Team (${teamWallet})`);

  // --- 3. 部署 FeeCollector (金库) ---
  console.log("\n3. Deploying FeeCollector...");
  
  // 根据网络选择 Router 地址
  const network = await ethers.provider.getNetwork();
  let routerAddress;
  let wethAddress; // WBNB
  
  if (network.chainId === 97n) { // BNB Testnet
    routerAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap Testnet Router
    wethAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"; // WBNB Testnet
  } else if (network.chainId === 56n) { // BNB Mainnet
    routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2 Router
    wethAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB
  } else {
    // 本地测试或其他链，部署 Mock Router 或使用占位符
    routerAddress = deployer.address; // 仅用于演示
    wethAddress = deployer.address;
    console.log("Warning: Unknown network, using deployer address as Router");
  }

  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(bufferTokenAddress, routerAddress, wethAddress);
  await feeCollector.waitForDeployment();
  const feeCollectorAddress = await feeCollector.getAddress();
  console.log("FeeCollector deployed to:", feeCollectorAddress);

  // --- 4. 部署 Escrow (UUPS 可升级) ---
  console.log("\n4. Deploying Escrow (UUPS)...");
  
  const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
  // initialize 函数参数: _treasury
  const escrow = await upgrades.deployProxy(Escrow, [feeCollectorAddress], { 
    initializer: 'initialize',
    kind: 'uups' 
  });
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow Proxy deployed to:", escrowAddress);

  // --- 5. 部署 MockAggregator (如果是测试网) ---
  let mockFeedAddress;
  if (network.chainId === 97n || network.chainId === 31337n) {
      console.log("\n5. Deploying MockAggregator...");
      const MockAggregator = await ethers.getContractFactory("MockAggregator");
      const mockPriceFeed = await MockAggregator.deploy(8, 200000000000); // $2000, 8 decimals
      await mockPriceFeed.waitForDeployment();
      mockFeedAddress = await mockPriceFeed.getAddress();
      console.log("MockAggregator deployed to:", mockFeedAddress);

      // 配置 Escrow 使用 Mock Feed (例如绑定 ETH/BNB 价格)
      console.log("Setting Token Price Feed...");
      // address(0) 代表原生代币
      await (await escrow.setTokenPriceFeed(ethers.ZeroAddress, mockFeedAddress)).wait();
      console.log("Set Native Token Price Feed to Mock");
  }

  // --- 6. 保存部署信息 ---
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      BufferToken: bufferTokenAddress,
      FeeCollector: feeCollectorAddress,
      EscrowProxy: escrowAddress,
      MockAggregator: mockFeedAddress
    }
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
