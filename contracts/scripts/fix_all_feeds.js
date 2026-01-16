const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking ALL Feeds...");

  const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const frontendConfigPath = path.join(__dirname, "../../handshake-web/src/config.json");
  const frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath, "utf8"));
  const tokens = frontendConfig["97"].tokens;

  const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
  const escrow = Escrow.attach(deployment.escrow).connect(deployer);
  const bnbFeed = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";

  for (const token of tokens) {
      if (token.symbol === "BNB") continue;
      const feed = await escrow.tokenPriceFeeds(token.address);
      console.log(`${token.symbol}: ${feed}`);
      
      if (feed === ethers.ZeroAddress) {
          console.log(`Configuring ${token.symbol}...`);
          await (await escrow.setTokenPriceFeed(token.address, bnbFeed)).wait();
      }
  }
  console.log("Done.");
}

main().catch(console.error);
