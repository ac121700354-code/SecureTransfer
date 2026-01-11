const { ethers } = require("hardhat");

async function main() {
    const [deployer, user] = await ethers.getSigners();
    console.log("Testing Gas Usage...");

    // 1. Deploy BufferToken
    const BufferToken = await ethers.getContractFactory("BufferToken");
    const token = await BufferToken.deploy(deployer.address, deployer.address, ethers.parseUnits("1000000", 18));
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();

    // 2. Deploy Escrow (Simplified Setup)
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrowImpl = await Escrow.deploy();
    await escrowImpl.waitForDeployment();
    
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const initData = Escrow.interface.encodeFunctionData("initialize", [deployer.address]); // treasury = deployer
    const escrowProxy = await ERC1967Proxy.deploy(await escrowImpl.getAddress(), initData);
    await escrowProxy.waitForDeployment();
    const escrow = Escrow.attach(await escrowProxy.getAddress());

    // Setup Mock Aggregator for Escrow
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const aggregator = await MockAggregator.deploy(8, 30000000000n); // $300
    await aggregator.waitForDeployment();
    await escrow.setTokenPriceFeed(ethers.ZeroAddress, await aggregator.getAddress()); // Native

    // 3. Deploy ActivityRewards
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    const rewards = await ActivityRewards.deploy(tokenAddr, await escrow.getAddress());
    await rewards.waitForDeployment();

    // Fund Rewards
    await token.transfer(await rewards.getAddress(), ethers.parseUnits("1000", 18));

    // --- MEASURE GAS: Transfer (Escrow.initiate) ---
    console.log("\n--- Escrow.initiate Gas ---");
    
    // User needs to send Native Token
    const amount = ethers.parseEther("0.01"); // > $1 threshold
    
    // 1st Transfer (Daily Count 0 -> 1, Init Storage)
    const tx1 = await escrow.connect(user).initiate(ethers.ZeroAddress, deployer.address, amount, { value: amount });
    const receipt1 = await tx1.wait();
    console.log(`1st Transfer (Storage Init): ${receipt1.gasUsed.toString()} gas`);

    // 2nd Transfer (Daily Count 1 -> 2, Update Storage)
    const tx2 = await escrow.connect(user).initiate(ethers.ZeroAddress, deployer.address, amount, { value: amount });
    const receipt2 = await tx2.wait();
    console.log(`2nd Transfer (Storage Update): ${receipt2.gasUsed.toString()} gas`);

    // --- MEASURE GAS: Claim Reward ---
    console.log("\n--- ActivityRewards.claimTaskReward Gas ---");
    // Target: 1 transfer (User has done 2)
    const tx3 = await rewards.connect(user).claimTaskReward(1, ethers.parseEther("1"));
    const receipt3 = await tx3.wait();
    console.log(`Claim Reward: ${receipt3.gasUsed.toString()} gas`);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
