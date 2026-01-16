const fs = require('fs');
const path = require('path');

const DEPLOYMENT_PATH = path.join(__dirname, '../deployment-testnet.json');
const FRONTEND_CONFIG_PATH = path.join(__dirname, '../../handshake-web/src/config.json');

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
  
  // 3. 更新地址
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

  // Update Contracts
  if (config[chainId].contracts) {
    if (config[chainId].contracts.BufferToken) {
      console.log(`Updating BufferToken contract address to ${deployment.token}`);
      config[chainId].contracts.BufferToken.address = deployment.token;
    }
    
    // Note: Frontend config might use different keys like 'Escrow' or 'SecureHandshakeUnlimitedInbox'
    // Let's check keys. Based on file read, it seems keys are Contract Names.
    
    if (config[chainId].contracts.SecureHandshakeUnlimitedInbox) {
      console.log(`Updating SecureHandshakeUnlimitedInbox address to ${deployment.escrow}`);
      config[chainId].contracts.SecureHandshakeUnlimitedInbox.address = deployment.escrow;
    } else if (config[chainId].contracts.Escrow) {
        console.log(`Updating Escrow address to ${deployment.escrow}`);
        config[chainId].contracts.Escrow.address = deployment.escrow;
    }

    if (config[chainId].contracts.ActivityRewards) {
      console.log(`Updating ActivityRewards address to ${deployment.rewards}`);
      config[chainId].contracts.ActivityRewards.address = deployment.rewards;
    }
    
    if (config[chainId].contracts.FeeCollector) {
      console.log(`Updating FeeCollector address to ${deployment.feeCollector}`);
      config[chainId].contracts.FeeCollector.address = deployment.feeCollector;
    }
  }

  // 4. 写回文件
  fs.writeFileSync(FRONTEND_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("Frontend config updated successfully!");
}

main();
