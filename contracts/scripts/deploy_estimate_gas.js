const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("📊 Estimating Gas for Full Deployment...");
    const [deployer] = await ethers.getSigners();
    
    let totalGas = 0n;
    
    // Helper to estimate deployment gas
    const estimateDeploy = async (name, factory, args = []) => {
        const deployTx = await factory.getDeployTransaction(...args);
        const gas = await ethers.provider.estimateGas(deployTx);
        console.log(`   - ${name}: ${gas.toString()} gas`);
        return gas;
    };

    // 1. Timelock
    const Timelock = await ethers.getContractFactory("Timelock");
    const gasTimelock = await estimateDeploy("Timelock", Timelock, [
        86400, 
        [deployer.address], 
        [ethers.ZeroAddress], 
        deployer.address
    ]);
    totalGas += gasTimelock;

    // 2. BufferToken
    const BufferToken = await ethers.getContractFactory("BufferToken");
    const gasToken = await estimateDeploy("BufferToken", BufferToken, [
        deployer.address, 
        deployer.address, // Mock timelock address for estimation
        ethers.parseUnits("100000000", 18)
    ]);
    totalGas += gasToken;

    // 3. FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const gasFee = await estimateDeploy("FeeCollector", FeeCollector, [
        deployer.address, // Mock token
        "0x10ED43C718714eb63d5aA57B78B54704E256024E", // BSC Router
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
        deployer.address
    ]);
    totalGas += gasFee;

    // 4. Escrow (Proxy + Impl)
    // Estimating proxy deployment is tricky without sending, but we can approximate:
    // Impl deploy + Proxy deploy + Init call
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const gasEscrowImpl = await estimateDeploy("Escrow (Implementation)", Escrow, []);
    
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    // Mock init data
    const initData = Escrow.interface.encodeFunctionData("initialize", [deployer.address]);
    const gasProxy = await estimateDeploy("Escrow (Proxy)", ERC1967Proxy, [deployer.address, initData]);
    
    totalGas += gasEscrowImpl + gasProxy;

    // 5. ActivityRewards
    const ActivityRewards = await ethers.getContractFactory("ActivityRewards");
    const gasRewards = await estimateDeploy("ActivityRewards", ActivityRewards, [
        deployer.address,
        deployer.address
    ]);
    totalGas += gasRewards;

    console.log("---------------------------------------------------");
    console.log(`🔥 Total Gas Estimated: ${totalGas.toString()}`);
    
    // Price Estimation
    const gweiPrice = 3n; // BNB Chain Avg (3 Gwei)
    const ethPrice = 10n; // Ethereum Avg (10 Gwei)
    
    const bnbCost = (totalGas * gweiPrice * 1000000000n);
    const ethCost = (totalGas * ethPrice * 1000000000n);

    console.log(`💰 Cost on BNB Chain (3 Gwei): ~${ethers.formatEther(bnbCost)} BNB`);
    console.log(`💰 Cost on Ethereum (10 Gwei): ~${ethers.formatEther(ethCost)} ETH`);
    console.log(`\n(Note: This is contract deployment only. Setup txs like transferOwnership will add ~10-20% more)`);
}

main().catch(console.error);
