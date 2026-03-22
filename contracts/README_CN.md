# Handshk Protocol - 智能合约仓库

Handshk Protocol 是一个安全、以意图为中心（Intent-centric）的 Web3 支付层协议，旨在消除“手滑转错”错误并实现无需信任的 P2P 交易。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-%5E0.8.20-blue)
![Network](https://img.shields.io/badge/network-BSC_Testnet-yellow)

## 🚀 核心功能

### 1. 🛡️ 安全握手 (Escrow)
- **两步转账**：`发起 (Initiate)` -> `确认 (Confirm)`。资金会被锁定，直到发送方明确释放。
- **安全撤回**：在确认释放之前，发送方可以随时 `取消 (Cancel)` 并取回资金。
- **防垃圾骚扰**：内置收件箱/发件箱容量限制和最小转账门槛保护。
- **公平定价**：基于 Chainlink 预言机的动态费率结构（最低 $0.01 - 封顶 $1.0）。

### 2. 🎁 活跃奖励 (增长引擎)
- **每日签到**：每日活跃可获奖励，连续签到（7天周期）有额外加成。
- **任务系统**：完成链上任务（如“完成3笔转账”）赚取 $HK 代币。
- **女巫抵抗**：通过链上活动历史验证真人用户 (Proof-of-Humanity)。

### 3. 🪙 代币经济 (Handshk Token - $HK)
- **标准**：支持 ERC20 Permit (EIP-2612) 和投票 (ERC20Votes)。
- **通缩机制**：FeeCollector 利用协议收入自动回购并销毁 $HK。
- **治理**：完全兼容 Governor Bravo 治理标准，为 DAO 铺路。

---

## 🏗️ 架构概览

### 合约映射表
| 合约文件 | 描述 | 状态 |
|----------|-------------|--------|
| `Escrow.sol` | 安全转账核心逻辑 (UUPS 可升级) | ✅ 已审计 |
| `ActivityRewards.sol` | 用户参与度与游戏化逻辑 | ✅ 运行中 |
| `FeeCollector.sol` | 收入管理与回购销毁 | ✅ 运行中 |
| `BufferToken.sol` | 治理代币 ($HK) 实现 | ✅ 运行中 |
| `Timelock.sol` | 延时管理员控制 (安全锁) | ✅ 运行中 |

---

## 🛠️ 开发与部署

### 前置要求
- Node.js v16+
- Hardhat
- 拥有 tBNB 的 BSC 测试网钱包

### 安装
```bash
git clone https://github.com/your-repo/handshk-contracts.git
cd handshk-contracts
npm install
```

### 编译
```bash
npx hardhat compile
```

### 测试
```bash
npx hardhat test
```

### 部署 (BSC 测试网)
请先创建 `.env` 文件并配置 `PRIVATE_KEY` 和 `BSCSCAN_API_KEY`。
```bash
npx hardhat run scripts/deploy/deploy_all_testnet.js --network bnb_testnet
```

---

## 🎮 演示与使用

### 实时演示 (Testnet)
- **Escrow 代理合约**: `0x17a5Be666d3a8F95815910D469ef16a861a56bE4`
- **奖励系统合约**: `0xcF64E3E534068598D80F65d606554869273946F9`

### 使用教程 (视频演示)
> [演示视频链接] (建议：录制一个 30秒的 Loom/YouTube 视频，展示“发起 -> 检查 -> 确认”的全过程)

1. **发起转账**：发送方将资金锁定在合约中。
2. **复核**：交易出现在发送方的“待处理发件箱 (Pending Outbox)”中。
3. **确认**：发送方核对无误后，点击“确认”将资金释放给接收方。
   （或者点击“取消”立即取回资金）。

---

## 🔐 安全与审计

- **模式**：采用 UUPS 代理模式以支持合约升级。
- **存储**：实施了存储间隙 (Storage Gaps) 以防止升级冲突。
- **预言机**：集成 Chainlink 价格源，并包含过时检查与心跳验证。
- **防护**：严格应用 `ReentrancyGuard` (防重入)、`Pausable` (紧急暂停) 和 `Ownable` (权限管理)。

---

## 🗺️ 路线图

- [x] 阶段 1: 核心 Escrow 与代币发行 (测试网)
- [x] 阶段 2: 活跃奖励与游戏化系统
- [ ] 阶段 3: 主网发布与审计
- [ ] 阶段 4: DAO 治理移交

## 📄 许可证
MIT
