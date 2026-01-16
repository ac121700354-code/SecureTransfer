const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking USDT Feed with account:", deployer.address);

  const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
  const escrow = Escrow.attach(deployment.escrow).connect(deployer);

  const usdtAddress = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
  const feed = await escrow.tokenPriceFeeds(usdtAddress);
  
  console.log(`USDT Address: ${usdtAddress}`);
  console.log(`Feed Address: ${feed}`);

  if (feed === ethers.ZeroAddress) {
      console.log("Feed NOT set! Configuring now...");
      const bnbFeed = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526"; // Reuse BNB Feed
      const tx = await escrow.setTokenPriceFeed(usdtAddress, bnbFeed);
      await tx.wait();
      console.log("Feed Configured!");
  } else {
      console.log("Feed already set.");
      // Check if feed works
      try {
        const feedContract = await ethers.getContractAt("AggregatorV3Interface", feed);
        const data = await feedContract.latestRoundData();
        console.log("Feed Data:", data);
      } catch (e) {
          console.error("Feed Error:", e.message);
      }
  }
}

main().catch(console.error);
