// Token Distribution Configuration
// Based on the Whitepaper Tokenomics (Total Supply: 100,000,000 STP)
require("dotenv").config(); // Ensure env vars are loaded if this file is imported standalone

module.exports = {
    tokenName: "STP",
    tokenSymbol: "STP",
    totalSupply: "100000000", // 100 Million

    distribution: {
        // 45% - Community Mining & Airdrop
        community: {
            percentage: 45,
            amount: "45000000",
            address: process.env.COMMUNITY_WALLET || "0x...", 
            description: "Community Mining & Airdrop"
        },

        // 20% - Ecosystem Fund
        ecosystem: {
            percentage: 20,
            amount: "20000000",
            address: process.env.ECOSYSTEM_WALLET || "0x...",
            description: "Ecosystem Fund"
        },

        // 15% - Core Team (Locked)
        team: {
            percentage: 15,
            amount: "15000000",
            address: process.env.TEAM_WALLET || "0x...",
            description: "Core Team (Locked)"
        },

        // 10% - Investors (Locked)
        investors: {
            percentage: 10,
            amount: "10000000",
            address: process.env.INVESTOR_WALLET || "0x...",
            description: "Investors (Locked)"
        },

        // 10% - DAO Treasury
        dao: {
            percentage: 10,
            amount: "10000000",
            address: process.env.DAO_WALLET || "0x...",
            description: "DAO Treasury"
        }
    }
};
