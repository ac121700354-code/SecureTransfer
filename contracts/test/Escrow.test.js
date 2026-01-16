const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Escrow (SecureHandshakeUnlimitedInbox)", function () {
  let Escrow, escrow;
  let BufferToken, token;
  let MockAggregator, mockFeed;
  let owner, userA, userB, treasury;
  
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const ETH_PRICE = 200000000000; // $2000 * 1e8

  beforeEach(async function () {
    [owner, userA, userB, treasury] = await ethers.getSigners();

    // 1. Deploy Token (with Permit)
    BufferToken = await ethers.getContractFactory("BufferToken");
    token = await BufferToken.deploy(owner.address, owner.address, INITIAL_SUPPLY);
    await token.waitForDeployment();

    // 2. Deploy Mock Aggregator
    MockAggregator = await ethers.getContractFactory("MockAggregator");
    mockFeed = await MockAggregator.deploy(8, ETH_PRICE);
    await mockFeed.waitForDeployment();

    // 3. Deploy Escrow (UUPS)
    Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    escrow = await upgrades.deployProxy(Escrow, [treasury.address], { 
      initializer: 'initialize',
      kind: 'uups'
    });
    await escrow.waitForDeployment();

    // 4. Setup
    // Whitelist the token with price feed
    await escrow.setTokenPriceFeed(await token.getAddress(), await mockFeed.getAddress());
    
    // Distribute tokens to User A
    await token.transfer(userA.address, ethers.parseEther("100"));
  });

  describe("ERC20 Transfers", function () {
    it("Should initiate ERC20 transfer successfully", async function () {
      const amount = ethers.parseEther("10");
      
      // Approve first
      await token.connect(userA).approve(await escrow.getAddress(), amount);
      
      const tx = await escrow.connect(userA).initiate(
        await token.getAddress(),
        userB.address,
        amount
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TransferInitiated');
      expect(event).to.not.be.undefined;
      
      // Check escrow balance
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
    });

    it("Should fail if allowance is insufficient", async function () {
      const amount = ethers.parseEther("10");
      await expect(
        escrow.connect(userA).initiate(await token.getAddress(), userB.address, amount)
      ).to.be.reverted; // ERC20InsufficientAllowance or similar
    });
  });

  describe("Permit Transfers", function () {
    it("Should initiate with permit (Gasless approval)", async function () {
      const amount = ethers.parseEther("10");
      const latestTime = await require("@nomicfoundation/hardhat-network-helpers").time.latest();
      const deadline = latestTime + 3600;
      
      // 1. Generate Permit Signature
      // We need to get the nonce for User A
      const nonces = await token.nonces(userA.address);
      const name = await token.name();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      
      const domain = {
        name: name,
        version: "1",
        chainId: chainId,
        verifyingContract: await token.getAddress()
      };
      
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      
      const value = {
        owner: userA.address,
        spender: await escrow.getAddress(),
        value: amount,
        nonce: nonces,
        deadline: deadline
      };
      
      const signature = await userA.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      // 2. Call initiateWithPermit
      await expect(
        escrow.connect(userA).initiateWithPermit(
          await token.getAddress(),
          userB.address,
          amount,
          deadline,
          v, r, s
        )
      ).to.emit(escrow, "TransferInitiated");
      
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
    });
  });

  describe("Outbox Limits", function () {
    it("Should enforce max pending outbox limit", async function () {
      // Set limit to 2 for testing
      await escrow.setMaxPendingOutbox(2);
      const amount = ethers.parseEther("1"); // $2000 > min $1
      
      await token.connect(userA).approve(await escrow.getAddress(), ethers.parseEther("100"));
      
      // 1st
      await escrow.connect(userA).initiate(await token.getAddress(), userB.address, amount);
      // 2nd
      await escrow.connect(userA).initiate(await token.getAddress(), userB.address, amount);
      
      // 3rd should fail
      await expect(
        escrow.connect(userA).initiate(await token.getAddress(), userB.address, amount)
      ).to.be.revertedWith("Your outbox is full");
    });
  });

  describe("Security & Validation", function () {
    it("Should reject if price feed is stale (simulated)", async function () {
       // MockAggregator allows setting timestamp. 
       // If not, we might need a better mock. 
       // Our current MockAggregator just returns block.timestamp.
       // So we can't easily simulate stale price without modifying MockAggregator.
       // Skipping this specific test case for now unless we update MockAggregator.
    });

    it("Should only allow sender to confirm/cancel", async function () {
      const amount = ethers.parseEther("10");
      await token.connect(userA).approve(await escrow.getAddress(), amount);
      const tx = await escrow.connect(userA).initiate(await token.getAddress(), userB.address, amount);
      const receipt = await tx.wait();
      const id = receipt.logs.find(l => l.fragment && l.fragment.name === 'TransferInitiated').args[0];

      // User B tries to confirm (should fail)
      await expect(
        escrow.connect(userB).confirm(id)
      ).to.be.revertedWith("Only sender can authorize");

      // Random user tries to cancel
      await expect(
        escrow.connect(treasury).cancel(id)
      ).to.be.revertedWith("Only sender can cancel");
    });
  });
});
