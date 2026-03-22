# Handshk Protocol - Web Interface

Handshk Protocol is a secure, intent-centric payment layer for Web3, designed to eliminate "fat-finger" errors and enable trustless P2P transactions.

This repository contains the frontend DApp for interacting with the Handshk Protocol smart contracts.

## 🚀 Features

- **Secure Transfer**: Initiate and release transfers with a two-step process.
- **Activity Rewards**: Check-in daily and claim rewards for using the protocol.
- **Wallet Integration**: Supports MetaMask, Rabby, and other Injected Wallets.
- **Real-time Updates**: View pending inbox/outbox and transaction history.

## 🛠️ Tech Stack

- **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Web3**: [Ethers.js](https://docs.ethers.org/v6/)
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/handshk-web.git
   cd handshk-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   VITE_ESCROW_ADDRESS=0x17a5Be666d3a8F95815910D469ef16a861a56bE4
   VITE_REWARDS_ADDRESS=0xcF64E3E534068598D80F65d606554869273946F9
   VITE_TOKEN_ADDRESS=0x... (Your BufferToken Address)
   VITE_CHAIN_ID=97 (BSC Testnet)
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🌐 Deployment

Build for production:
```bash
npm run build
```

The output will be in the `dist` directory, ready to be deployed to Vercel, Netlify, or IPFS.

## 📄 License

MIT
