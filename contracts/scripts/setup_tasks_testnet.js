const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up tasks with account:", deployer.address);

  // 1. Load deployment
  const deploymentPath = path.join(__dirname, "../deployment-testnet.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment file not found!");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const rewardsAddress = deployment.rewards;
  console.log("ActivityRewards Address:", rewardsAddress);

  // 2. Connect to contract
  const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
  const rewards = ActivityRewards.attach(rewardsAddress).connect(deployer);

  // 3. Add Tasks
  // Task Type: 0 = DAILY, 1 = CUMULATIVE
  
  // Task 1: Daily Transfer (Target: 1, Reward: 10 BFR)
  console.log("Adding Daily Task...");
  try {
    const tx1 = await rewards.addTask(
      1, // Target Count
      ethers.parseEther("10"), // Reward Amount
      0 // TaskType.DAILY
    );
    await tx1.wait();
    console.log("Daily Task added!");
  } catch (e) {
    console.error("Failed to add Daily Task:", e.message);
  }

  // Task 2: Cumulative Transfer (Target: 5, Reward: 50 BFR)
  console.log("Adding Cumulative Task...");
  try {
    const tx2 = await rewards.addTask(
      5, // Target Count
      ethers.parseEther("50"), // Reward Amount
      1 // TaskType.CUMULATIVE
    );
    await tx2.wait();
    console.log("Cumulative Task added!");
  } catch (e) {
    console.error("Failed to add Cumulative Task:", e.message);
  }

  // 4. Verify
  const tasks = await rewards.getAllTasks();
  console.log("\nCurrent Tasks:");
  tasks.forEach((task) => {
    console.log(`- Task ID: ${task.taskId}`);
    console.log(`  Type: ${task.taskType === 0n ? "DAILY" : "CUMULATIVE"}`);
    console.log(`  Target: ${task.targetCount}`);
    console.log(`  Reward: ${ethers.formatEther(task.rewardAmount)} BFR`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
