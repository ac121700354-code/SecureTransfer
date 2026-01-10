const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
    // Manually gathered from previous deployment logs
    const bufferTokenAddress = "0x73Ed01D39408bC5A582896a6F69d6193e7017Af7";
    const feeCollectorAddress = "0x1d99D9737EDa3AB8D1A326CBA1456DA153c6E607";
    const escrowAddress = "0x37E9FD365504E6b838FD94bea8AE3eb7D48290e1";
    const aggregatorAddress = "0xb9713EA42C0f14692FDc674b5dA4881701adc910";
    const timelockAddress = "0x34C2Ef4618e61ABC033d3CC380BecB3011e6ceA8";
    const activityRewardsAddress = "0xD872BdC7B66231f8eDcB7039c2cA3144977Dcc13";

    // Additional configuration
    const currentNet = {
        tokens: {
            USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            USDC: "0x64544969ed7EBf5f083679233325356EbE738930",
            BTC: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8",
            ETH: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378"
        }
    };
    
    // Config path
    const frontendConfigPath = path.join(__dirname, "../../handshake-web/src/config.json");
    let frontendConfig = {};
    
    if (fs.existsSync(frontendConfigPath)) {
        try {
            frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath));
        } catch (e) {
            console.warn("Could not parse existing frontend config, creating new.");
        }
    }

    const chainId = "97"; // BNB Testnet

    // Construct Tokens List
    const tokensList = [];
    
    // 1. BNB
    tokensList.push({
        symbol: "BNB",
        name: "BNB",
        logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=035",
        address: ethers.ZeroAddress
    });

    // 2. Buffer Token (HK)
    tokensList.push({
        symbol: "HK",
        name: "Handshk Token",
        logo: "/tokens/bfr-logo.svg?v=12",
        address: bufferTokenAddress
    });

    // 3. Others
    const standardTokens = [
        { key: "USDT", name: "Tether USD", logo: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=035" },
        { key: "USDC", name: "USD Coin", logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035" },
        { key: "BTC", name: "Bitcoin", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=035" },
        { key: "ETH", name: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=035" }
    ];

    for (const t of standardTokens) {
        if (currentNet.tokens[t.key]) {
             tokensList.push({
                 symbol: t.key,
                 name: t.name,
                 logo: t.logo,
                 address: currentNet.tokens[t.key]
             });
        }
    }

    frontendConfig[chainId] = {
        networkName: "bnb_testnet",
        rpcUrl: "https://bsc-testnet.publicnode.com",
        explorer: "https://testnet.bscscan.com",
        tokens: tokensList,
        contracts: {
            BufferToken: {
                address: bufferTokenAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/BufferToken.sol/BufferToken.json"))).abi
            },
            EscrowProxy: {
                address: escrowAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Escrow.sol/SecureHandshakeUnlimitedInbox.json"))).abi
            },
            MockAggregator: {
                address: aggregatorAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/MockAggregator.sol/MockAggregator.json"))).abi
            },
            Timelock: {
                address: timelockAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Timelock.sol/Timelock.json"))).abi
            },
            ActivityRewards: {
                address: activityRewardsAddress,
                abi: JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/ActivityRewards.sol/ActivityRewards.json"))).abi
            },
            USDT: { address: currentNet.tokens.USDT },
            USDC: { address: currentNet.tokens.USDC },
            BTC: { address: currentNet.tokens.BTC },
            ETH: { address: currentNet.tokens.ETH }
        }
    };

    fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
    console.log(`Frontend config updated for Chain ID ${chainId}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
