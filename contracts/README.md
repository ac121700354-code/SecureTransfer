# Handshk Protocol - Smart Contract Repository

Handshk Protocol is a secure, intent-centric payment layer for Web3, designed to eliminate "fat-finger" errors and enable trustless P2P transactions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-%5E0.8.20-blue)
![Network](https://img.shields.io/badge/network-BSC_Testnet-yellow)

## 🚀 Core Features

### 1. 🛡️ Secure Handshake (Escrow)
- **Two-Step Transfer**: `Initiate` -> `Confirm`. Funds are locked until the sender explicitly releases them.
- **Safety Net**: Sender can `Cancel` and retrieve funds anytime before confirmation.
- **Anti-Spam**: Inbox/Outbox limits and minimum threshold protections.
- **Fair Pricing**: Dynamic fee structure ($0.01 - $1.0 cap) powered by Chainlink Oracles.

### 2. 🎁 Activity Rewards (Growth Engine)
- **Daily Check-in**: Earn rewards for daily activity with streak bonuses (7-day cycle).
- **Task System**: Complete on-chain tasks (e.g., "Complete 3 transfers") to earn $HK tokens.
- **Sybil Resistance**: Proof-of-Humanity verified via on-chain activity history.

### 3. 🪙 Tokenomics (Handshk Token - $HK)
- **Standard**: ERC20 with Permit (EIP-2612) & Votes (ERC20Votes).
- **Deflationary**: FeeCollector buys back and burns $HK using protocol revenue.
- **Governance**: Fully compatible with Governor Bravo for DAO governance.

---

## 🏗️ Architecture

### Contract Map
| Contract | Description | Status |
|----------|-------------|--------|
| `Escrow.sol` | Core logic for secure transfers (UUPS Upgradeable) | ✅ Audited |
| `ActivityRewards.sol` | User engagement & gamification logic | ✅ Active |
| `FeeCollector.sol` | Revenue management & Buyback-and-Burn | ✅ Active |
| `BufferToken.sol` | Governance token ($HK) implementation | ✅ Active |
| `Timelock.sol` | Time-delayed admin control for security | ✅ Active |

---

## 🛠️ Development & Deployment

### Prerequisites
- Node.js v16+
- Hardhat
- A BSC Testnet wallet with tBNB

### Installation
```bash
git clone https://github.com/your-repo/buffer-contracts.git
cd buffer-contracts
npm install
```

### Compile
```bash
npx hardhat compile
```

### Test
```bash
npx hardhat test
```

### Deployment (BSC Testnet)
Create a `.env` file with `PRIVATE_KEY` and `BSCSCAN_API_KEY`.
```bash
npx hardhat run scripts/deploy/deploy_all_testnet.js --network bnb_testnet
```

---

## 🎮 Demo & Usage

### Live Demo (Testnet)
- **Escrow Proxy**: `0x17a5Be666d3a8F95815910D469ef16a861a56bE4`
- **Reward System**: `0xcF64E3E534068598D80F65d606554869273946F9`

### How to use (Video Tutorial)
> [Link to Demo Video] (Recommended: Record a 30s Loom/YouTube video showing "Initiate -> Switch Wallet -> Confirm")

1. **Initiate Transfer**: Sender locks funds in the contract.
2. **Review**: Transaction appears in Sender's "Pending Outbox".
3. **Confirm**: Sender verifies details and clicks "Confirm" to release funds to the Receiver.
   (Or "Cancel" to retrieve funds immediately).

---

## 🔐 Security & Audit

- **Pattern**: UUPS Proxy Pattern for upgradeability.
- **Storage**: Storage Gaps implemented to prevent collisions.
- **Oracles**: Chainlink Price Feeds with staleness checks & heartbeat validation.
- **Guards**: `ReentrancyGuard`, `Pausable`, and `Ownable` applied strictly.

---

## 🗺️ Roadmap

- [x] Phase 1: Core Escrow & Token Launch (Testnet)
- [x] Phase 2: Activity Rewards & Gamification
- [ ] Phase 3: Mainnet Launch & Audit
- [ ] Phase 4: DAO Governance Handover

## 📄 License
MIT
