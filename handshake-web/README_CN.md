# Handshk Protocol - Web 前端仓库

Handshk Protocol 是一个安全、以意图为中心（Intent-centric）的 Web3 支付层协议，旨在消除“手滑转错”错误并实现无需信任的 P2P 交易。

本仓库包含与 Handshk Protocol 智能合约交互的前端 DApp 代码。

## 🚀 功能特性

- **安全转账**：通过两步验证流程（发起 -> 释放）保障资金安全。
- **活跃奖励**：每日签到并完成任务，赚取协议奖励。
- **钱包集成**：支持 MetaMask、Rabby 及其他主流浏览器插件钱包。
- **实时更新**：实时查看待处理的收/发件箱及历史交易记录。

## 🛠️ 技术栈

- **框架**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **Web3**: [Ethers.js](https://docs.ethers.org/v6/)
- **图标**: [React Icons](https://react-icons.github.io/react-icons/)

## 📦 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-repo/handshk-web.git
   cd handshk-web
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   在根目录创建 `.env` 文件：
   ```env
   VITE_ESCROW_ADDRESS=0x17a5Be666d3a8F95815910D469ef16a861a56bE4
   VITE_REWARDS_ADDRESS=0xcF64E3E534068598D80F65d606554869273946F9
   VITE_TOKEN_ADDRESS=0x... (填入您的 BufferToken 地址)
   VITE_CHAIN_ID=97 (BSC Testnet)
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

## 🌐 打包部署

构建生产版本：
```bash
npm run build
```

构建产物将输出至 `dist` 目录，可直接部署至 Vercel, Netlify 或 IPFS。

## 📄 许可证

MIT
