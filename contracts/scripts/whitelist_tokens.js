const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Operating with account:", deployer.address);

  // EscrowProxy 地址 (BSC Testnet)
  const proxyAddress = "0xb6422f04579872B75e1E1D88c016E3589014FAFC";
  
  // MockAggregator 地址 (用于所有 Token 的价格预言机，仅作测试)
  const mockAggregator = "0x0512f7573e137FEbD07eD73d442AEad8B220Bb96";

  // 连接到合约
  const Escrow = await hre.ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
  const escrow = Escrow.attach(proxyAddress);

  const tokens = [
    { symbol: "USDT", address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" },
    { symbol: "USDC", address: "0x64544969ed7EBf5f083679233325356EbE738930" }
  ];

  for (const token of tokens) {
    console.log(`Whitelisting ${token.symbol} (${token.address})...`);
    try {
        // 调用 setTokenPriceFeed 来白名单代币
        const tx = await escrow.setTokenPriceFeed(token.address, mockAggregator);
        console.log(`Tx sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ ${token.symbol} whitelisted (Feed: ${mockAggregator}).`);
    } catch (e) {
        console.error(`❌ Failed to whitelist ${token.symbol}:`, e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});