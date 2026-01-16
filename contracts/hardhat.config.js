require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
    },
    bnb_testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 5000000000, // Lower to 5 Gwei to save gas
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
      timeout: 60000
    },
    bnb_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 5000000000, // 5 Gwei
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: "https://1rpc.io/sepolia",
      chainId: 11155111,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY,
  },
};
