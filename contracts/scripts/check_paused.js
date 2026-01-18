
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deployment = JSON.parse(fs.readFileSync("deployment-testnet.json"));
    const escrowAddress = deployment.escrow;
    const Escrow = await ethers.getContractFactory("SecureHandshakeUnlimitedInbox");
    const escrow = Escrow.attach(escrowAddress);

    console.log("Checking Paused State...");
    const paused = await escrow.paused();
    console.log("Is Paused:", paused);

    if (paused) {
        console.error("ERROR: Contract is PAUSED!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
