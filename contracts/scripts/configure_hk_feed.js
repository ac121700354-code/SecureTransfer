const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Configuring HK Token Feed with account:", deployer.address);

  const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
  const escrow = Escrow.attach(deployment.escrow).connect(deployer);

  const hkTokenAddress = deployment.token;
  // Use BNB Feed for HK Token for testing purposes
  const bnbFeed = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";

  console.log("Setting Price Feed for HK Token...");
  console.log("Token:", hkTokenAddress);
  console.log("Feed:", bnbFeed);

  const tx = await escrow.setTokenPriceFeed(hkTokenAddress, bnbFeed);
  await tx.wait();

  console.log("Success! HK Token is now whitelisted.");
}

main().catch(console.error);
