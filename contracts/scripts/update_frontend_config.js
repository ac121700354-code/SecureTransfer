const fs = require('fs');
const path = require('path');

const DEPLOYMENT_PATH = path.join(__dirname, '../deployment-testnet.json');
const FRONTEND_CONFIG_PATH = path.join(__dirname, '../../handshake-web/src/config.json');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/contracts');

// Mapping: Contract Key in Config -> Artifact Path
const CONTRACT_MAP = {
  "BufferToken": "core/BufferToken.sol/BufferToken.json",
  "FeeCollector": "core/FeeCollector.sol/FeeCollector.json",
  "SecureHandshakeUnlimitedInbox": "core/Escrow.sol/SecureHandshakeUnlimitedInbox.json",
  "ActivityRewards": "core/ActivityRewards.sol/ActivityRewards.json",
  "Timelock": "core/Timelock.sol/Timelock.json"
};

function main() {
  // 1. 读取最新部署信息
  if (!fs.existsSync(DEPLOYMENT_PATH)) {
    console.error(`Deployment file not found at ${DEPLOYMENT_PATH}`);
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
  console.log("Loaded deployment:", deployment);

  // 2. 读取前端配置
  if (!fs.existsSync(FRONTEND_CONFIG_PATH)) {
    console.error(`Frontend config not found at ${FRONTEND_CONFIG_PATH}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(FRONTEND_CONFIG_PATH, 'utf8'));
  
  // 3. 更新地址与ABI
  const chainId = "97"; // BNB Testnet
  if (!config[chainId]) {
    console.error(`Chain ID ${chainId} not found in config`);
    process.exit(1);
  }

  // Update BufferToken (HK Token) in tokens list
  const hkToken = config[chainId].tokens.find(t => t.symbol === "HK");
  if (hkToken) {
    console.log(`Updating HK Token address from ${hkToken.address} to ${deployment.token}`);
    hkToken.address = deployment.token;
  }

  // Helper to update contract config
  const updateContract = (configKey, deploymentKey) => {
    if (!config[chainId].contracts[configKey]) {
        console.log(`Creating config entry for ${configKey}`);
        config[chainId].contracts[configKey] = {};
    }

    // Update Address
    const newAddress = deployment[deploymentKey];
    if (newAddress) {
        console.log(`Updating ${configKey} address to ${newAddress}`);
        config[chainId].contracts[configKey].address = newAddress;
    }

    // Update ABI
    const artifactPath = CONTRACT_MAP[configKey];
    if (artifactPath) {
        const fullPath = path.join(ARTIFACTS_DIR, artifactPath);
        if (fs.existsSync(fullPath)) {
            const artifact = JSON.parse(fs.readFileSync(fullPath));
            config[chainId].contracts[configKey].abi = artifact.abi;
            console.log(`Updated ABI for ${configKey}`);
        } else {
            console.warn(`Artifact not found: ${fullPath}`);
        }
    }
  };

  // Update Contracts
  // Mapping: Config Key -> Deployment JSON Key
  updateContract("BufferToken", "token");
  updateContract("FeeCollector", "feeCollector");
  updateContract("SecureHandshakeUnlimitedInbox", "escrow");
  updateContract("ActivityRewards", "rewards");
  // updateContract("Timelock", "timelock"); // Optional if frontend uses it

  // 4. 写回文件
  fs.writeFileSync(FRONTEND_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("Frontend config updated successfully!");
}

main();
