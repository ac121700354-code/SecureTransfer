const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying Mock BTC...");

    const MockToken = await ethers.getContractFactory("MockToken");
    // Mint 1000 BTC to deployer
    const initialSupply = ethers.parseUnits("1000", 18);
    const btc = await MockToken.deploy("Bitcoin", "BTC", initialSupply);
    await btc.waitForDeployment();
    
    const btcAddress = await btc.getAddress();
    console.log(`Mock BTC deployed to: ${btcAddress}`);

    // Update config.json
    const configPath = path.join(__dirname, "../../handshake-web/src/config.json");
    const config = JSON.parse(fs.readFileSync(configPath));

    // Update Sepolia BTC
    if (config["11155111"]) {
        const token = config["11155111"].tokens.find(t => t.symbol === "BTC");
        if (token) {
            token.address = btcAddress;
            console.log("Updated config.json with new BTC address");
        }
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
