const { ethers } = require("hardhat");
const deployment = require("../deployment.json");
require("dotenv").config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

// PancakeSwap V2 Router Address on BSC Testnet
const ROUTER_ADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";

// Liquidity Settings
const TOKEN_AMOUNT = ethers.parseEther("1000"); // Add 1000 BFR
const BNB_AMOUNT = ethers.parseEther("0.1");    // Add 0.1 BNB
// This sets initial price: 1 BNB = 10,000 BFR

async function main() {
    console.log("Starting Liquidity Provision Script...");

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with: ${wallet.address}`);

    const bufferTokenAddress = deployment.contracts.BufferToken;
    console.log(`BFR Token Address: ${bufferTokenAddress}`);

    // 1. Get Token Contract
    const Token = await ethers.getContractFactory("BufferToken");
    const token = Token.attach(bufferTokenAddress).connect(wallet);

    // Check Balance
    const balance = await token.balanceOf(wallet.address);
    console.log(`Wallet BFR Balance: ${ethers.formatEther(balance)}`);
    if (balance < TOKEN_AMOUNT) {
        console.error("Insufficient BFR balance to add liquidity!");
        return;
    }

    // 2. Approve Router
    console.log("\n1. Approving PancakeSwap Router...");
    const currentAllowance = await token.allowance(wallet.address, ROUTER_ADDRESS);
    if (currentAllowance < TOKEN_AMOUNT) {
        const tx = await token.approve(ROUTER_ADDRESS, ethers.MaxUint256);
        console.log(`Approval tx sent: ${tx.hash}`);
        await tx.wait();
        console.log("Approved successfully.");
    } else {
        console.log("Already approved.");
    }

    // 3. Add Liquidity
    console.log("\n2. Adding Liquidity (BFR + BNB)...");
    
    // We need the Router Interface
    const routerAbi = [
        "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
    ];
    const router = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins from now

    try {
        const tx = await router.addLiquidityETH(
            bufferTokenAddress,
            TOKEN_AMOUNT,
            0, // amountTokenMin (slippage 100% allowed for testnet)
            0, // amountETHMin
            wallet.address, // to
            deadline,
            { value: BNB_AMOUNT }
        );
        console.log(`Add Liquidity tx sent: ${tx.hash}`);
        await tx.wait();
        console.log("Liquidity Pool Created/Added Successfully!");
        console.log(`Added: ${ethers.formatEther(TOKEN_AMOUNT)} BFR + ${ethers.formatEther(BNB_AMOUNT)} BNB`);
    } catch (error) {
        console.error("Failed to add liquidity:", error.message);
        if (error.message.includes("TRANSFER_FROM_FAILED")) {
            console.error("Possible cause: Token has transfer tax or restriction?");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
