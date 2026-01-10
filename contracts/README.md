# BNB Smart Chain 合约模板

- 合约语言：`Solidity ^0.8.20`
- 链兼容：EVM（BSC 主网与测试网均可）
- 包含合约：
  - `contracts/BufferToken.sol`：标准 ERC20，封顶、铸造、销毁、暂停、黑名单
  - `contracts/MerkleDistributor.sol`：Merkle 空投领取合约（批量分发）
  - `contracts/TokenVesting.sol`：线性归属合约（start/cliff/duration/total）

## 快速编译（Remix）
- 打开 `https://remix.ethereum.org`
- 在 Remix 中创建文件夹并上传本仓库的 `contracts` 文件
- 选择编译器版本 `0.8.20`
- 依次编译 `BufferToken.sol`、`MerkleDistributor.sol`、`TokenVesting.sol`

## BSC 部署
- 主网 RPC：`https://bsc-dataseed.binance.org`
- 测试网 RPC：`https://bsc-testnet.publicnode.com`
- 通过 Remix 连接钱包（MetaMask），切换到对应网络
- 部署顺序建议：
  1. 部署 `BufferToken`（代币）
  2. 根据需求部署 `MerkleDistributor`（空投）与 `TokenVesting`（归属）

## 构造参数
- `BufferToken(name, symbol, cap, owner)`
  - `name`：代币名称，例如 `SecureTransfer Token`
  - `symbol`：代币符号，例如 `STP`
  - `cap`：最大供应量（包含 18 位精度），例如 `1_000_000 * 1e18`
  - `owner`：初始所有者地址（如填 `0x0` 则默认部署者）
- `MerkleDistributor(token, merkleRoot, owner)`
  - `token`：已部署的代币地址
  - `merkleRoot`：离线生成的 Merkle 根（空投清单）
  - `owner`：合约管理员地址
- `TokenVesting(token, owner)`
  - `token`：已部署的代币地址（合约需持有归属所需代币）
  - `owner`：合约管理员地址

## 常用操作
- 代币铸造：`BufferToken.mint(to, amount)`（仅 `owner`）
- 暂停/恢复：`pause()` / `unpause()`（暂停影响转账与授权）
- 黑名单：`setBlacklist(account, true/false)`（转账授权受限）
- 空投：
  - 将空投总量转入 `MerkleDistributor` 合约
  - 受益人调用 `claim(index, account, amount, proof)` 领取
- 归属：
  - 管理员调用 `setVesting(beneficiary, total, start, cliff, duration)` 建立归属
  - 受益人调用 `claim()` 自助领取已归属部分
  - 管理员调用 `releaseFor(beneficiary)` 代释放

## Merkle 根生成
- 推荐离线使用脚本生成每个条目 `keccak256(index, account, amount)` 的 Merkle 树
- 根填入部署参数 `merkleRoot`
- 空投列表需与部署的 `token` 精度一致（默认为 18 位）

## 安全与审计
- 生产部署前建议进行专业审计与测试
- 管理员私钥与权限需严格控制
- 合约不依赖第三方库，便于审计与最小攻击面

## 下一步个性化
- 如需税费、交易保护、治理投票、可升级代理、跨链桥接等模块，请提供白皮书的核心参数与机制说明（总量、分配、归属策略、交易约束、治理规则等），我将为你定制扩展版本。
