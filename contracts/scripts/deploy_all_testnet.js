const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  // --- Configuration (BNB Testnet) ---
  const WBNB_ADDRESS = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const PANCAKE_ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  const CHAINLINK_BNB_USD = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";
  const DAO_TREASURY = deployer.address; // Use deployer as treasury for testnet

  const deployedContracts = {};

  try {
    // 1. Deploy Timelock
    console.log("\n1. Deploying Timelock...");
    const minDelay = 600; // 10 minutes for testnet
    const Timelock = await ethers.getContractFactory("Timelock");
    const timelock = await Timelock.deploy(minDelay, [deployer.address], [deployer.address], deployer.address);
    await timelock.waitForDeployment();
    deployedContracts.timelock = await timelock.getAddress();
    console.log("Timelock deployed to:", deployedContracts.timelock);

    // 2. Deploy BufferToken
    console.log("\n2. Deploying BufferToken...");
    const initialSupply = ethers.parseEther("100000000"); // 100M
    const BufferToken = await ethers.getContractFactory("BufferToken");
    const token = await BufferToken.deploy(deployer.address, deployedContracts.timelock, initialSupply);
    await token.waitForDeployment();
    deployedContracts.token = await token.getAddress();
    console.log("BufferToken deployed to:", deployedContracts.token);

    // 3. Deploy FeeCollector
    console.log("\n3. Deploying FeeCollector...");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollector = await FeeCollector.deploy(
      deployedContracts.token,
      PANCAKE_ROUTER,
      WBNB_ADDRESS,
      DAO_TREASURY
    );
    await feeCollector.waitForDeployment();
    deployedContracts.feeCollector = await feeCollector.getAddress();
    console.log("FeeCollector deployed to:", deployedContracts.feeCollector);

    // 4. Deploy Escrow (UUPS Proxy)
    console.log("\n4. Deploying Escrow (SecureHandshakeUnlimitedInbox)...");
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = await upgrades.deployProxy(Escrow, [deployedContracts.feeCollector], { 
      initializer: 'initialize',
      kind: 'uups'
    });
    await escrow.waitForDeployment();
    deployedContracts.escrow = await escrow.getAddress();
    console.log("Escrow deployed to:", deployedContracts.escrow);

    // 5. Deploy ActivityRewards
    console.log("\n5. Deploying ActivityRewards...");
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    // Using Chainlink Feed for timestamp
    const rewards = await ActivityRewards.deploy(
      deployedContracts.token, 
      deployedContracts.escrow,
      CHAINLINK_BNB_USD // Use price feed as timestamp source proxy if needed, or check if this feed supports roundId timestamp
    ); 
    // Note: ActivityRewards expects an AggregatorV3Interface to get timestamp.
    // Price feeds return timestamp in latestRoundData, so it works.
    await rewards.waitForDeployment();
    deployedContracts.rewards = await rewards.getAddress();
    console.log("ActivityRewards deployed to:", deployedContracts.rewards);

    // --- Configuration ---
    console.log("\n--- Configuring Contracts ---");

    // A. Configure Escrow
    console.log("Configuring Escrow...");
    // Set Native Token Price Feed (BNB)
    await escrow.setTokenPriceFeed(ethers.ZeroAddress, CHAINLINK_BNB_USD);
    console.log("Escrow: Set BNB Price Feed");

    // B. Configure FeeCollector
    console.log("Configuring FeeCollector...");
    await feeCollector.setBuybackEnabled(true);
    // Whitelist WBNB for buyback check
    await feeCollector.setPriceFeed(WBNB_ADDRESS, CHAINLINK_BNB_USD); 
    console.log("FeeCollector: Enabled Buyback & Set WBNB Feed");

    // C. Configure BufferToken Roles (Optional: Grant Minter to Rewards?)
    // Usually Rewards contract needs to be funded, not minter.
    // We will fund ActivityRewards with some tokens.
    console.log("Funding ActivityRewards...");
    const fundAmount = ethers.parseEther("10000");
    await token.transfer(deployedContracts.rewards, fundAmount);
    console.log(`Transferred ${ethers.formatEther(fundAmount)} BFR to ActivityRewards`);

    // --- Save Deployment Info ---
    const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deployedContracts, null, 2));
    console.log(`\nDeployment info saved to ${deploymentPath}`);

    // Verify reminder
    console.log("\nTo verify contracts run:");
    console.log(`npx hardhat verify --network bnb_testnet ${deployedContracts.token} "${deployer.address}" "${deployedContracts.timelock}" "${initialSupply}"`);
    // Add other verify commands...

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main();
