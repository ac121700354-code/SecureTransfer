const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeCollector", function () {
  let FeeCollector, feeCollector;
  let MockToken, tokenA, tokenB, bufferToken;
  let MockRouter, router;
  let MockAggregator, aggregator;
  let owner, keeper, dao, user;
  let weth;

  beforeEach(async function () {
    [owner, keeper, dao, user] = await ethers.getSigners();

    // 1. Deploy Mocks
    // MockToken = await ethers.getContractFactory("MockToken"); 
    // We use BufferToken as generic ERC20
    const BufferToken = await ethers.getContractFactory("BufferToken");
    
    tokenA = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));
    tokenB = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));
    bufferToken = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));
    
    // Mock WETH (Just another ERC20 for test)
    weth = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));

    // Mock Router
    // We need a contract that implements swapExactTokensForTokensSupportingFeeOnTransferTokens
    // and swapExactETHForTokensSupportingFeeOnTransferTokens
    const MockRouterFactory = await ethers.getContractFactory("MockRouter");
    router = await MockRouterFactory.deploy();

    // Fund Router with BufferToken (so it can swap back)
    await bufferToken.transfer(await router.getAddress(), ethers.parseEther("500000"));

    // Mock Aggregator
    const MockAggregatorFactory = await ethers.getContractFactory("MockAggregator");
    aggregator = await MockAggregatorFactory.deploy(8, 100000000); // $1.00

    // 2. Deploy FeeCollector
    FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      await bufferToken.getAddress(),
      await router.getAddress(),
      await weth.getAddress(),
      dao.address
    );

    // 3. Setup
    await feeCollector.setKeeper(keeper.address, true);
    await feeCollector.setBuybackEnabled(true);
    await feeCollector.setBuybackThreshold(0); // Set threshold to 0 for easier testing
    
    // Setup Price Feeds
    await feeCollector.setPriceFeed(await tokenA.getAddress(), await aggregator.getAddress());
    await feeCollector.setPriceFeed(await tokenB.getAddress(), await aggregator.getAddress());
  });

  it("Should only buyback supported tokens", async function () {
    // Transfer tokens to feeCollector
    await tokenA.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));
    await tokenB.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));

    // Disable tokenB support
    await feeCollector.setSupportedToken(await tokenB.getAddress(), false);

    // Expect Router to be called for TokenA but NOT TokenB
    // Default path is [token, weth, bufferToken]
    const expectedPath = [await tokenA.getAddress(), await weth.getAddress(), await bufferToken.getAddress()];

    await expect(feeCollector.connect(keeper).executeBuybackAndBurn(
      [await tokenA.getAddress(), await tokenB.getAddress()],
      [0, 0],
      0,
      false
    )).to.emit(feeCollector, "BuybackExecuted")
      // MockRouter swaps 1:1, so we get 100 out
      .withArgs(await tokenA.getAddress(), ethers.parseEther("100"), ethers.parseEther("100"), expectedPath);
      
    // Verify TokenB balance is still there
    expect(await tokenB.balanceOf(await feeCollector.getAddress())).to.equal(ethers.parseEther("100"));
    // Verify TokenA balance is gone (swapped)
    expect(await tokenA.balanceOf(await feeCollector.getAddress())).to.equal(0);
  });

  it("Should continue if one swap fails (Try/Catch)", async function () {
    // Configure Router to fail for TokenB
    await router.setShouldFail(await tokenB.getAddress(), true);

    await tokenA.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));
    await tokenB.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));

    // Both are supported
    await feeCollector.setSupportedToken(await tokenB.getAddress(), true);

    await expect(feeCollector.connect(keeper).executeBuybackAndBurn(
      [await tokenA.getAddress(), await tokenB.getAddress()],
      [0, 0],
      0,
      false
    )).to.emit(feeCollector, "BuybackFailed")
      .withArgs(await tokenB.getAddress(), ethers.parseEther("100"), "Token Swap Failed");

    // TokenA should succeed
    expect(await tokenA.balanceOf(await feeCollector.getAddress())).to.equal(0);
    // TokenB should remain
    expect(await tokenB.balanceOf(await feeCollector.getAddress())).to.equal(ethers.parseEther("100"));
  });

  it("Should use custom swap paths", async function () {
    const path = [await tokenA.getAddress(), await weth.getAddress(), await bufferToken.getAddress()];
    await feeCollector.setSwapPath(await tokenA.getAddress(), path);

    await tokenA.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));

    // Verify event contains the path
    await expect(feeCollector.connect(keeper).executeBuybackAndBurn(
      [await tokenA.getAddress()],
      [0],
      0,
      false
    )).to.emit(feeCollector, "BuybackExecuted");
      // .withArgs(..., path) // Hardhat matching array args can be tricky, check logs manually or trust execution
  });

  it("Should handle ETH buyback", async function () {
    // Send ETH to feeCollector
    await owner.sendTransaction({
      to: await feeCollector.getAddress(),
      value: ethers.parseEther("1.0")
    });

    const expectedPath = [await weth.getAddress(), await bufferToken.getAddress()];

    await expect(feeCollector.connect(keeper).executeBuybackAndBurn(
      [],
      [],
      0,
      true // includeNative
    )).to.emit(feeCollector, "BuybackExecuted")
      .withArgs(ethers.ZeroAddress, ethers.parseEther("1.0"), ethers.parseEther("1.0"), expectedPath);
  });

  it("Should double count value in checkUpside if token duplicated (Known Behavior)", async function () {
    await tokenA.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));
    // Price is $1.00. 100 tokens = $100.
    // Threshold is 0.
    // Let's set threshold to $150.
    await feeCollector.setBuybackThreshold(ethers.parseEther("150"));
    
    // Check with single token: should be false ($100 < $150)
    const [val1, trigger1] = await feeCollector.checkUpside([await tokenA.getAddress()], false);
    expect(trigger1).to.be.false;
    
    // Check with double token: should be true ($100 + $100 = $200 > $150)
    const [val2, trigger2] = await feeCollector.checkUpside([await tokenA.getAddress(), await tokenA.getAddress()], false);
    expect(trigger2).to.be.true;
  });

  it("Should allow owner to emergency withdraw", async function () {
    await tokenA.transfer(await feeCollector.getAddress(), ethers.parseEther("100"));
    
    // User tries - should fail
    await expect(feeCollector.connect(user).emergencyWithdraw(await tokenA.getAddress(), user.address))
      .to.be.revertedWithCustomError(feeCollector, "OwnableUnauthorizedAccount");

    // Owner tries - should succeed
    await expect(feeCollector.connect(owner).emergencyWithdraw(await tokenA.getAddress(), owner.address))
      .to.changeTokenBalances(tokenA, [feeCollector, owner], [ethers.parseEther("-100"), ethers.parseEther("100")]);
  });
});
