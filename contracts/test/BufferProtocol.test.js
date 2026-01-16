const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Buffer Protocol Integration Test", function () {
  let bufferToken, feeCollector, escrow, mockFeed;
  let owner, userA, userB, treasuryWallet;

  // 模拟常量
  const ONE_DOLLAR_IN_BNB = ethers.parseEther("0.003"); // 假设 BNB = $333
  const FEE_BPS = 10n; // 0.1%

  before(async function () {
    [owner, userA, userB, treasuryWallet] = await ethers.getSigners();

    // 1. 部署 BufferToken
    const BufferToken = await ethers.getContractFactory("BufferToken");
    bufferToken = await BufferToken.deploy(owner.address, owner.address, ethers.parseEther("1000000"));
    await bufferToken.waitForDeployment();

    // 2. 部署 MockAggregator ($2000 ETH/BNB Price)
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    mockFeed = await MockAggregator.deploy(8, 200000000000); // $2000 * 1e8
    await mockFeed.waitForDeployment();

    // 3. 部署 FeeCollector
    // 本地测试没有真实 Router，我们用 owner 地址假装是 Router，或者部署一个 MockRouter
    // 为了简化，我们只测试 FeeCollector 接收资金，暂不测试 Swap (因为没有真实池子)
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      await bufferToken.getAddress(), 
      owner.address, 
      owner.address,
      treasuryWallet.address // DAO Treasury
    );
    await feeCollector.waitForDeployment();

    // 4. 部署 Escrow (UUPS)
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    escrow = await upgrades.deployProxy(Escrow, [await feeCollector.getAddress()], { 
      initializer: 'initialize',
      kind: 'uups' 
    });
    await escrow.waitForDeployment();

    // 5. 配置 Escrow
    // 设置 Native Token (BNB) 的预言机
    await escrow.setTokenPriceFeed(ethers.ZeroAddress, await mockFeed.getAddress());
  });

  it("Should allow initiate transfer with Native Token (BNB)", async function () {
    const amount = ethers.parseEther("1.0"); // 1 BNB
    
    // User A 发起转账给 User B
    const tx = await escrow.connect(userA).initiate(
      ethers.ZeroAddress, // Native Token
      userB.address,
      amount,
      { value: amount }
    );
    
    const receipt = await tx.wait();
    // 验证事件
    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TransferInitiated');
    expect(event).to.not.be.undefined;
    
    // 获取 Transaction ID
    const transferId = event.args[0];
    
    // 验证存储
    const record = await escrow.activeTransfers(transferId);
    expect(record.sender).to.equal(userA.address);
    expect(record.amount).to.equal(amount);
  });

  it("Should calculate fee correctly (Cap at $1.0)", async function () {
    // 1. 发起一笔大额转账 (10 BNB = $20,000)
    // 理论费用 0.1% = $20 -> 触发封顶 $1.0
    const amount = ethers.parseEther("10.0"); 
    const tx = await escrow.connect(userA).initiate(
      ethers.ZeroAddress,
      userB.address,
      amount,
      { value: amount }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TransferInitiated');
    const id = event.args[0];

    // 2. 记录余额
    const userBBalanceBefore = await ethers.provider.getBalance(userB.address);
    const collectorBalanceBefore = await ethers.provider.getBalance(await feeCollector.getAddress());

    // 3. 确认放款
    await escrow.connect(userA).confirm(id);

    // 4. 验证费用 ($1.0 in BNB at $2000/BNB = 0.0005 BNB)
    const userBBalanceAfter = await ethers.provider.getBalance(userB.address);
    const collectorBalanceAfter = await ethers.provider.getBalance(await feeCollector.getAddress());

    const expectedFee = ethers.parseEther("0.0005"); 
    
    expect(collectorBalanceAfter - collectorBalanceBefore).to.equal(expectedFee);
    expect(userBBalanceAfter - userBBalanceBefore).to.equal(amount - expectedFee);
  });

  it("Should calculate fee correctly (Floor at $0.01)", async function () {
    // 1. 发起一笔小额转账 (0.0025 BNB = $5.0)
    // 理论费用 0.1% = $0.005 -> 触发低保 $0.01
    const amount = ethers.parseEther("0.0025"); 
    const tx = await escrow.connect(userA).initiate(
      ethers.ZeroAddress,
      userB.address,
      amount,
      { value: amount }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TransferInitiated');
    const id = event.args[0];

    // 2. 记录余额
    const userBBalanceBefore = await ethers.provider.getBalance(userB.address);
    const collectorBalanceBefore = await ethers.provider.getBalance(await feeCollector.getAddress());

    // 3. 确认放款
    await escrow.connect(userA).confirm(id);

    // 4. 验证费用 ($0.01 in BNB at $2000/BNB = 0.000005 BNB)
    const userBBalanceAfter = await ethers.provider.getBalance(userB.address);
    const collectorBalanceAfter = await ethers.provider.getBalance(await feeCollector.getAddress());

    const expectedFee = ethers.parseEther("0.000005"); 
    
    // 允许微小误差 (1 wei)
    expect(collectorBalanceAfter - collectorBalanceBefore).to.closeTo(expectedFee, 1);
    expect(userBBalanceAfter - userBBalanceBefore).to.closeTo(amount - expectedFee, 1);
  });

  it("Should allow cancel and refund", async function () {
    const amount = ethers.parseEther("1.0");
    const tx = await escrow.connect(userA).initiate(
      ethers.ZeroAddress,
      userB.address,
      amount,
      { value: amount }
    );
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    const escrowBalanceBefore = await ethers.provider.getBalance(await escrow.getAddress());
    
    await escrow.connect(userA).cancel(id);
    
    const escrowBalanceAfter = await ethers.provider.getBalance(await escrow.getAddress());
    
    expect(escrowBalanceBefore - escrowBalanceAfter).to.equal(amount);
  });
});
