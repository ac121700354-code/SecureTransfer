const { ethers, network } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);

    const chainId = network.config.chainId;
    console.log(`Network: ${network.name} (${chainId})`);

    // 1. Load Deployment Info
    const deploymentPath = path.join(__dirname, '../deployment.json');
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("contracts/deployment.json not found. Please deploy first.");
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath));
    
    // Simple check to ensure we are on the intended network if deployment.json tracks it
    if (deployment.network && deployment.network.chainId && deployment.network.chainId !== chainId) {
        console.warn(`WARNING: Current chainId (${chainId}) does not match deployment.json (${deployment.network.chainId})`);
    }

    const escrowAddress = deployment.contracts.EscrowProxy;
    const feeCollectorAddress = deployment.contracts.FeeCollector;

    if (!escrowAddress) throw new Error("EscrowProxy address missing in deployment.json");

    console.log(`Escrow Contract: ${escrowAddress}`);
    console.log(`Fee Collector: ${feeCollectorAddress}`);

    // 2. Load Token Config
    const feedsPath = path.join(__dirname, '../token_feeds.json');
    if (!fs.existsSync(feedsPath)) {
        throw new Error("contracts/token_feeds.json not found.");
    }
    const allFeeds = JSON.parse(fs.readFileSync(feedsPath));
    const tokens = allFeeds[chainId.toString()] || allFeeds[chainId];

    if (!tokens || tokens.length === 0) {
        console.log(`No token configuration found for chainId ${chainId} in token_feeds.json`);
        return;
    }

    console.log(`Found ${tokens.length} tokens to configure.`);

    // 3. Get Contract Instances
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    
    const escrow = Escrow.attach(escrowAddress).connect(deployer);
    const feeCollector = feeCollectorAddress ? FeeCollector.attach(feeCollectorAddress).connect(deployer) : null;

    // 4. Batch Configure
    for (const t of tokens) {
        console.log(`\n---------------------------------------------------`);
        console.log(`Configuring [${t.symbol}]`);
        console.log(`  Address: ${t.address}`);
        console.log(`  Feed:    ${t.feed}`);

        try {
            // A. Configure Escrow
            const currentFeed = await escrow.tokenPriceFeeds(t.address);
            if (currentFeed.toLowerCase() === t.feed.toLowerCase()) {
                console.log("  ✅ Escrow: Already configured.");
            } else {
                process.stdout.write("  ⏳ Escrow: Setting feed... ");
                const tx = await escrow.setTokenPriceFeed(t.address, t.feed);
                await tx.wait();
                console.log("Done.");
            }

            // B. Configure FeeCollector (if applicable)
            // FeeCollector usually needs feeds to calculate fee swaps or value
            if (feeCollector) {
                // Check if FeeCollector supports this token (might throw if not whitelisted or no method)
                // We'll just try setting it.
                // Note: Some FeeCollectors might not support address(0) if they only handle ERC20s, 
                // but usually they should handle native if they collect fees in native.
                
                try {
                    // There is no easy 'get' method for price feed in FeeCollector typically exposed public variable might vary.
                    // We just overwrite to be safe or assuming it's cheap on testnet. 
                    // To optimize, one would check first if the contract exposes a getter.
                    
                    process.stdout.write("  ⏳ FeeCollector: Setting feed... ");
                    const tx2 = await feeCollector.setPriceFeed(t.address, t.feed);
                    await tx2.wait();
                    console.log("Done.");
                } catch (fcErr) {
                    // Ignore error if it's just that the function doesn't exist or token not supported
                    console.log(`\n  ⚠️  FeeCollector Error: ${fcErr.message.split('(')[0]}`); 
                }
            }

        } catch (e) {
            console.error(`\n  ❌ Error configuring ${t.symbol}:`, e.message);
        }
    }

    console.log(`\n---------------------------------------------------`);
    console.log("Batch configuration finished.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
