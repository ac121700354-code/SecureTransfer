const fs = require("fs");
const path = require("path");
const { network } = require("hardhat");

function getDeploymentPath() {
    const dir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // File name based on network: deployments/bnb_testnet.json
    return path.join(dir, `${network.name}.json`);
}

function loadDeployment() {
    const filePath = getDeploymentPath();
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath));
    }
    return {};
}

function saveDeployment(key, address) {
    const data = loadDeployment();
    data[key] = address;
    
    // Add metadata
    data["_network"] = network.name;
    data["_chainId"] = network.config.chainId;
    data["_updated"] = new Date().toISOString();

    fs.writeFileSync(getDeploymentPath(), JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${key}: ${address} [${network.name}]`);
}

function getDeployedAddress(key) {
    const data = loadDeployment();
    if (!data[key]) {
        throw new Error(`❌ Missing dependency: ${key} on network [${network.name}]. Please run the previous deploy script.`);
    }
    return data[key];
}

module.exports = {
    saveDeployment,
    getDeployedAddress,
    loadDeployment
};
