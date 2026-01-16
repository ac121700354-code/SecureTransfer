const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BufferToken", function () {
  let BufferToken;
  let bufferToken;
  let owner;
  let addr1;
  let addr2;
  let timelock;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens

  beforeEach(async function () {
    [owner, addr1, addr2, timelock] = await ethers.getSigners();
    
    // Deploy Token
    const BufferTokenFactory = await ethers.getContractFactory("BufferToken");
    bufferToken = await BufferTokenFactory.deploy(owner.address, timelock.address, INITIAL_SUPPLY);
    await bufferToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await bufferToken.balanceOf(owner.address);
      expect(await bufferToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should grant roles correctly", async function () {
      const DEFAULT_ADMIN_ROLE = await bufferToken.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await bufferToken.MINTER_ROLE();
      const PAUSER_ROLE = await bufferToken.PAUSER_ROLE();

      // Timelock should have all roles
      expect(await bufferToken.hasRole(DEFAULT_ADMIN_ROLE, timelock.address)).to.be.true;
      expect(await bufferToken.hasRole(MINTER_ROLE, timelock.address)).to.be.true;
      expect(await bufferToken.hasRole(PAUSER_ROLE, timelock.address)).to.be.true;

      // Owner should NOT have minter role by default (based on constructor logic)
      expect(await bufferToken.hasRole(MINTER_ROLE, owner.address)).to.be.false;
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      await bufferToken.transfer(addr1.address, 50);
      const addr1Balance = await bufferToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);

      await bufferToken.connect(addr1).transfer(addr2.address, 50);
      const addr2Balance = await bufferToken.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await bufferToken.balanceOf(owner.address);
      await expect(
        bufferToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.reverted; // OpenZeppelin 5.0 custom errors might revert differently, but usually reverts
    });
  });

  describe("Minting", function () {
    it("Should fail if non-minter tries to mint", async function () {
      await expect(
        bufferToken.mint(addr1.address, 1000)
      ).to.be.reverted;
    });

    it("Should allow timelock (minter) to mint", async function () {
      await bufferToken.connect(timelock).mint(addr1.address, 1000);
      expect(await bufferToken.balanceOf(addr1.address)).to.equal(1000);
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      await bufferToken.transfer(addr1.address, 1000);
      await bufferToken.connect(addr1).burn(500);
      expect(await bufferToken.balanceOf(addr1.address)).to.equal(500);
    });
  });
});
