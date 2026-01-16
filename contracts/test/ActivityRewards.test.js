const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ActivityRewards", function () {
  let ActivityRewards, rewards;
  let Escrow, escrow;
  let BufferToken, token; // Reward Token
  let MockAggregator, mockFeed;
  let owner, userA, userB;
  
  const REWARD_AMOUNT = ethers.parseEther("10");
  const TARGET_COUNT = 3;

  beforeEach(async function () {
    [owner, userA, userB] = await ethers.getSigners();

    // 1. Deploy Token
    BufferToken = await ethers.getContractFactory("BufferToken");
    token = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // 2. Deploy Mock Price Feed
    MockAggregator = await ethers.getContractFactory("MockAggregator");
    mockFeed = await MockAggregator.deploy(8, 200000000000);
    await mockFeed.waitForDeployment();

    // 3. Deploy Escrow
    Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    escrow = await upgrades.deployProxy(Escrow, [owner.address], { initializer: 'initialize', kind: 'uups' });
    await escrow.waitForDeployment();
    
    // Config Escrow
    await escrow.setTokenPriceFeed(ethers.ZeroAddress, await mockFeed.getAddress());

    // 4. Deploy ActivityRewards
    ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    // Pass address(0) for timestampFeed to use block.timestamp
    rewards = await ActivityRewards.deploy(await token.getAddress(), await escrow.getAddress(), ethers.ZeroAddress);
    await rewards.waitForDeployment();

    // Fund the rewards contract
    await token.transfer(await rewards.getAddress(), ethers.parseEther("1000"));
  });

  describe("Check-in System", function () {
    it("Should allow daily check-in and update streak", async function () {
      // Day 1
      await rewards.connect(userA).checkIn();
      let info = await rewards.userCheckIns(userA.address);
      expect(info.streak).to.equal(1);
      
      // Try again same day (should fail)
      await expect(rewards.connect(userA).checkIn()).to.be.revertedWith("Already checked in today");

      // Advance 1 day
      await time.increase(86401);
      
      // Day 2
      await rewards.connect(userA).checkIn();
      info = await rewards.userCheckIns(userA.address);
      expect(info.streak).to.equal(2);
    });

    it("Should reset streak if missed a day", async function () {
      // Day 1
      await rewards.connect(userA).checkIn();
      
      // Advance 2 days (missed one day)
      await time.increase(86400 * 2 + 10);
      
      // Day 3 (should reset to 1)
      await rewards.connect(userA).checkIn();
      const info = await rewards.userCheckIns(userA.address);
      expect(info.streak).to.equal(1);
    });
  });

  describe("Task System", function () {
    let dailyTaskId, cumulativeTaskId;

    beforeEach(async function () {
      // Add Tasks
      // Task 1: Daily Task (3 transfers)
      await rewards.addTask(TARGET_COUNT, REWARD_AMOUNT, 0); // 0 = DAILY
      dailyTaskId = 1;

      // Task 2: Cumulative Task (5 transfers)
      await rewards.addTask(5, REWARD_AMOUNT * 2n, 1); // 1 = CUMULATIVE
      cumulativeTaskId = 2;
    });

    // Helper to generate transfers in Escrow
    async function generateTransfers(count) {
      const amount = ethers.parseEther("0.001"); // $2
      for (let i = 0; i < count; i++) {
        await escrow.connect(userA).initiate(ethers.ZeroAddress, userB.address, amount, { value: amount });
      }
    }

    it("Should claim Daily Task reward", async function () {
      // 1. Complete task
      await generateTransfers(TARGET_COUNT);
      
      // 2. Check progress
      const progress = await rewards.connect(userA).getTaskProgress(dailyTaskId);
      expect(progress.actualCount).to.equal(TARGET_COUNT);
      expect(progress.completed).to.be.true;

      // 3. Claim
      const balanceBefore = await token.balanceOf(userA.address);
      await rewards.connect(userA).claimTaskReward(dailyTaskId);
      const balanceAfter = await token.balanceOf(userA.address);
      
      expect(balanceAfter - balanceBefore).to.equal(REWARD_AMOUNT);

      // 4. Try claim again (should fail)
      await expect(rewards.connect(userA).claimTaskReward(dailyTaskId)).to.be.revertedWith("Already claimed today");
    });

    it("Should reset Daily Task status next day", async function () {
      // Day 1: Complete and Claim
      await generateTransfers(TARGET_COUNT);
      await rewards.connect(userA).claimTaskReward(dailyTaskId);
      
      // Advance to Day 2
      await time.increase(86401);
      // Update Price Feed timestamp to avoid "Price expired"
      await mockFeed.updateAnswer(200000000000);
      
      // Check status (should be not completed because daily count resets in Escrow logic naturally based on timestamp)
      // Note: Escrow.dailyTransferCounts takes a 'day' param.
      // ActivityRewards calculates 'day' based on block.timestamp.
      // So on Day 2, Escrow will return 0 for the new day.
      
      const progress = await rewards.connect(userA).getTaskProgress(dailyTaskId);
      expect(progress.actualCount).to.equal(0);
      
      // Do transfers for Day 2
      await generateTransfers(TARGET_COUNT);
      
      // Claim again
      await expect(rewards.connect(userA).claimTaskReward(dailyTaskId)).to.not.be.reverted;
    });

    it("Should claim Cumulative Task reward", async function () {
      // Need 5 transfers total
      await generateTransfers(5);
      
      await rewards.connect(userA).claimTaskReward(cumulativeTaskId);
      
      // Try claim again (should fail)
      await expect(rewards.connect(userA).claimTaskReward(cumulativeTaskId)).to.be.revertedWith("Already claimed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to add and remove tasks", async function () {
      await rewards.addTask(10, ethers.parseEther("1"), 0);
      const tasks = await rewards.getTaskIds();
      expect(tasks.length).to.equal(1);
      
      await rewards.removeTask(tasks[0]);
      const tasksAfter = await rewards.getTaskIds();
      expect(tasksAfter.length).to.equal(0);
    });
  });
});
