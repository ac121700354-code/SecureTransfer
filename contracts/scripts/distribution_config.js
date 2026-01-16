// Token Distribution Configuration
// Based on the Whitepaper Tokenomics (Total Supply: 100,000,000 STP)
require("dotenv").config(); // Ensure env vars are loaded if this file is imported standalone

module.exports = {
    tokenName: "HK",
    tokenSymbol: "HK",
    totalSupply: "1000000000", // 1 Billion

    distribution: {
        // 50% - Community Mining & Airdrop
        community: {
            percentage: 50,
            amount: "500000000",
            address: process.env.COMMUNITY_WALLET || "0x...", 
            description: "Community Mining & Airdrop"
        },

        // 20% - Ecosystem Fund
        ecosystem: {
            percentage: 20,
            amount: "200000000",
            address: process.env.ECOSYSTEM_WALLET || "0x...",
            description: "Ecosystem Fund"
        },

        // 15% - Core Team (Locked)
        team: {
            percentage: 15,
            amount: "150000000",
            address: process.env.TEAM_WALLET || "0x...",
            description: "Core Team (Locked)"
        },

        // 15% - Investors & Advisors (Locked)
        investors: {
            percentage: 15,
            amount: "150000000",
            address: process.env.INVESTOR_WALLET || "0x...",
            description: "Investors & Advisors (Locked)"
        }
    }
};
