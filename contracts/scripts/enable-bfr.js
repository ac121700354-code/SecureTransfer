const hre = require("hardhat");
const config = require("../handshake-web/src/config.json");

async function main() {
  console.log("Setting up BFR token support on BNB Testnet...");

  const EscrowAddress = config.contracts.EscrowProxy.address;
  const BFRAddress = config.contracts.BufferToken.address;
  const MockFeedAddress = config.contracts.MockAggregator.address;

  console.log(`Escrow: ${EscrowAddress}`);
  console.log(`BFR Token: ${BFRAddress}`);
  console.log(`Price Feed: ${MockFeedAddress}`);

  // Get signer
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Executing with account: ${deployer.address}`);

  // Connect to contract
  const Escrow = await hre.ethers.getContractAt("SecureHandshakeUnlimitedInbox", EscrowAddress);

  // Check current feed
  const currentFeed = await Escrow.tokenPriceFeeds(BFRAddress);
  console.log(`Current feed for BFR: ${currentFeed}`);

  if (currentFeed.toLowerCase() === MockFeedAddress.toLowerCase()) {
    console.log("✅ BFR already configured correctly. No action needed.");
    return;
  }

  // Set feed
  console.log("🚀 Calling setTokenPriceFeed...");
  const tx = await Escrow.setTokenPriceFeed(BFRAddress, MockFeedAddress);
  console.log(`Transaction sent: ${tx.hash}`);
  
  await tx.wait();
  console.log("✅ Transaction confirmed! BFR support enabled.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});