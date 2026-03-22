const { ethers } = require("hardhat");

async function main() {
    const addr1 = "0x17a5Be666d3a8F95815910D469ef16a861a56bE4"; // SecureHandshakeUnlimitedInbox
    const addr2 = "0x497589ab12326be34007FeeB66168C0CD85fC8e5"; // EscrowProxy

    console.log("Checking addresses...");

    const code1 = await ethers.provider.getCode(addr1);
    const code2 = await ethers.provider.getCode(addr2);

    console.log(`Address 1 (${addr1}) code length: ${code1.length}`);
    console.log(`Address 2 (${addr2}) code length: ${code2.length}`);

    // Check implementation slot for addr1
    try {
        const impl1 = await ethers.provider.getStorage(addr1, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
        console.log(`Address 1 Implementation Slot: ${impl1}`);
    } catch (e) { console.log("Addr1 is not a proxy (or failed to read slot)"); }

    // Check implementation slot for addr2
    try {
        const impl2 = await ethers.provider.getStorage(addr2, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
        console.log(`Address 2 Implementation Slot: ${impl2}`);
    } catch (e) { console.log("Addr2 is not a proxy (or failed to read slot)"); }

    // Check if one is the implementation of the other
    const implAddr1 = "0x" + (await ethers.provider.getStorage(addr1, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc")).slice(-40);
    const implAddr2 = "0x" + (await ethers.provider.getStorage(addr2, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc")).slice(-40);

    console.log("Impl 1:", implAddr1);
    console.log("Impl 2:", implAddr2);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
