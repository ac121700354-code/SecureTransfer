module.exports = {
    // Hardhat Local
    "hardhat": {
        router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", 
        weth: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
        tokens: {
            USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            USDC: "0x64544969ed7EBf5f083679233325356EbE738930",
            BTC: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8",
            ETH: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378"
        }
    },

    // BNB Chain Testnet
    "bnb_testnet": {
        router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", // PancakeSwap V2 Testnet
        weth: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",   // WBNB Testnet
        tokens: {
            USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
            USDC: "0x64544969ed7EBf5f083679233325356EbE738930",
            BTC: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8",
            ETH: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378"
        }
    },
    
    // Ethereum Mainnet
    "ethereum": {
        router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",   // WETH
        tokens: {
            USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            BTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
            ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // WETH
        }
    },

    // BNB Chain Mainnet
    "bsc": {
        router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
        weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",   // WBNB
        tokens: {
            USDT: "0x55d398326f99059fF775485246999027B3197955",
            USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
            BTC: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // BTCB
            ETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8"  // ETH
        }
    },

    // Sepolia Testnet
    "sepolia": {
        router: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008", // Uniswap V2 Router (Testnet)
        weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",   // WETH Sepolia
        tokens: {
            USDT: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06", // USDT Sepolia (Mock)
            USDC: "0xda9d4f9b69ac629241243741487b755c66a88193", // USDC Sepolia (Mock)
            BTC: "0x8e81547879549925bA8e3d23199859A302693259",  // WBTC Sepolia (Mock)
            ETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"   // WETH
        }
    },

    // Arbitrum One
    "arbitrum": {
        router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap V2 (Arbitrum) - Verify this!
        weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",   // WETH
        tokens: {
            USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            BTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
            ETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
        }
    }
    
    // Add more networks (Polygon, Optimism, Base...) here
};
