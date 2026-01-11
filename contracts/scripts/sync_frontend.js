const fs = require("fs");
const path = require("path");

// Paths
const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");
const ARTIFACTS_DIR = path.join(__dirname, "../artifacts/contracts");
const FRONTEND_CONFIG = path.join(__dirname, "../../handshake-web/src/config.json");

// Mapping: Deployment Key -> Contract Name (for Artifacts)
const CONTRACT_MAP = {
    "BufferToken": "BufferToken.sol/BufferToken.json",
    "Timelock": "Timelock.sol/Timelock.json",
    "FeeCollector": "FeeCollector.sol/FeeCollector.json",
    "EscrowProxy": "Escrow.sol/SecureHandshakeUnlimitedInbox.json", // Proxy uses Impl ABI
    "ActivityRewards": "ActivityRewards.sol/ActivityRewards.json"
};

function main() {
    console.log("🔄 Syncing Frontend Config...");

    if (!fs.existsSync(FRONTEND_CONFIG)) {
        console.error(`❌ Frontend config not found at: ${FRONTEND_CONFIG}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(FRONTEND_CONFIG));
    const deploymentFiles = fs.readdirSync(DEPLOYMENTS_DIR).filter(f => f.endsWith(".json"));

    deploymentFiles.forEach(file => {
        const deployData = JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, file)));
        const chainId = deployData._chainId;

        if (!chainId) return; // Skip if no chainId

        console.log(`   Processing Chain ID: ${chainId} (${file})...`);

        if (!config[chainId]) {
            console.warn(`   ⚠️ Config for Chain ID ${chainId} not found in frontend config. Creating skeleton...`);
            config[chainId] = {
                networkName: deployData._network,
                tokens: [],
                contracts: {}
            };
        }

        // Update Contracts
        for (const [key, address] of Object.entries(deployData)) {
            if (key.startsWith("_")) continue; // Skip metadata

            const artifactPath = CONTRACT_MAP[key];
            if (!artifactPath) {
                console.warn(`   ⚠️ No artifact mapping for ${key}, skipping ABI update.`);
                // Update address only if exists
                if (config[chainId].contracts[key]) {
                    config[chainId].contracts[key].address = address;
                }
                continue;
            }

            const fullArtifactPath = path.join(ARTIFACTS_DIR, artifactPath);
            if (fs.existsSync(fullArtifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(fullArtifactPath));
                
                config[chainId].contracts[key] = {
                    address: address,
                    abi: artifact.abi
                };
                console.log(`     ✅ Updated ${key}: ${address}`);
            } else {
                console.warn(`     ❌ Artifact not found: ${artifactPath}`);
            }
        }
    });

    fs.writeFileSync(FRONTEND_CONFIG, JSON.stringify(config, null, 2));
    console.log(`\n✨ Frontend config updated successfully!`);
}

main();
