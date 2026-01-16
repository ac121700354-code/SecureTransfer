const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Timelock", function () {
  let Timelock, timelock;
  let admin, proposer, executor, other;
  
  const MIN_DELAY = 3600; // 1 hour

  beforeEach(async function () {
    [admin, proposer, executor, other] = await ethers.getSigners();
    
    Timelock = await ethers.getContractFactory("Timelock");
    timelock = await Timelock.deploy(
      MIN_DELAY,
      [proposer.address],
      [executor.address],
      admin.address
    );
    await timelock.waitForDeployment();
  });

  it("Should set correct roles", async function () {
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

    expect(await timelock.hasRole(PROPOSER_ROLE, proposer.address)).to.be.true;
    expect(await timelock.hasRole(EXECUTOR_ROLE, executor.address)).to.be.true;
    expect(await timelock.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
  });

  it("Should enforce delay on execution", async function () {
    // We will schedule a transaction to update the delay
    // target: timelock itself
    // value: 0
    // data: updateDelay(newDelay)
    // predecessor: bytes32(0)
    // salt: random bytes32
    
    const target = await timelock.getAddress();
    const value = 0;
    const newDelay = 7200;
    const data = timelock.interface.encodeFunctionData("updateDelay", [newDelay]);
    const predecessor = ethers.ZeroHash;
    const salt = ethers.id("salt");
    
    // 1. Schedule (by Proposer)
    await timelock.connect(proposer).schedule(target, value, data, predecessor, salt, MIN_DELAY);
    
    // 2. Try execute immediately (should fail)
    await expect(
      timelock.connect(executor).execute(target, value, data, predecessor, salt)
    ).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    
    // 3. Advance time
    await time.increase(MIN_DELAY + 1);
    
    // 4. Execute (by Executor)
    await timelock.connect(executor).execute(target, value, data, predecessor, salt);
    
    expect(await timelock.getMinDelay()).to.equal(newDelay);
  });
});
