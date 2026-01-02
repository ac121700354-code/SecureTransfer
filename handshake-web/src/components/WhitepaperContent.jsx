import React from 'react';

export const WhitepaperContentZh = () => (
  <div className="space-y-8 text-slate-300">
    <div className="text-center border-b border-white/10 pb-8">
      <h1 className="text-3xl font-bold text-white mb-2">链上安全转账协议白皮书</h1>
      <p className="text-blue-400 font-medium">安全、可信、可撤回的下一代区块链转账协议</p>
    </div>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">1.</span> 摘要
      </h3>
      <p className="leading-relaxed">
        链上安全转账协议（On-Chain Escrow Transfer Protocol）是一项基于智能合约构建的非托管式区块链资产转账解决方案。本协议旨在解决区块链交易“不可逆、高风险”的核心痛点，为所有个人与企业用户提供一层额外的安全交易保障。我们不托管用户资金，而是通过代码逻辑实现了“链上时间锁”和“双向确认”机制，彻底消除转账焦虑。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">2.</span> 问题陈述：不可逆痛点
      </h3>
      <p className="leading-relaxed mb-4">
        区块链技术的特性决定了其不可篡改与不可逆性。这既是安全的基石，也带来了巨大的使用风险。一笔转账如果输错地址，就永久丢失；遭到诈骗诱导转账，资金也无法追回。据行业安全机构统计，每年因误操作和欺诈导致的链上资产损失高达数十亿美元。
      </p>
      <div className="bg-slate-800/50 p-4 rounded-xl border-l-4 border-rose-500">
        <p className="text-sm">
          现有的解决方案，如传统的担保交易（Escrow）往往依赖中心化服务商（如交易所），不仅成本高昂，且存在“黑箱”风险（资金可能被冻结或挪用）。我们需要一种完全去中心化的、透明的、代码即法律的链上安全机制。
        </p>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">3.</span> 解决方案：链上安全机制
      </h3>
      
      <h4 className="font-bold text-white mt-4 mb-2">3.1 核心概念</h4>
      <p className="mb-4">我们将传统的“转账即完成”机制，拆解为三个阶段的流程：</p>
      <ul className="space-y-3">
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[3rem]">锁定</span>
          <span>发送方将资金发送至协议的智能合约中进行锁定，资金不再由发送方控制，但尚未到达接收方。</span>
        </li>
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[3rem]">确认</span>
          <span>收款方在前端页面可见这笔待接收的交易，核对金额与来源无误后，进行“确认接收”操作。</span>
        </li>
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[3rem]">执行</span>
          <span>资金正式从合约划转至收款方账户。在此期间，发送方拥有“后悔权”，可随时在收款方确认前撤回资金。</span>
        </li>
      </ul>

      <h4 className="font-bold text-white mt-6 mb-2">3.2 技术架构</h4>
      <p className="leading-relaxed">
        协议层完全开源，运行在EVM兼容链上。核心组件包括：
      </p>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
        <li><strong className="text-slate-200">智能合约：</strong>负责资金的托管逻辑，代码经过严格审计，无后门。</li>
        <li><strong className="text-slate-200">前端DApp：</strong>提供直观的用户界面，连接钱包即可使用，无服务器存储私钥。</li>
        <li><strong className="text-slate-200">事件监听：</strong>链下索引服务，用于实时通知用户交易状态变化。</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">4.</span> 经济模型与代币治理
      </h3>
      
      <h4 className="font-bold text-white mt-4 mb-2">4.1 协议服务费</h4>
      <p className="mb-4">协议将对每笔成功完成的安全转账收取微量服务费（如 0.1% 或固定金额），用于：</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-emerald-400 mb-1">50%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">回购销毁</div>
          <p className="text-xs mt-2 text-slate-500">购买协议代币(STP)并销毁，制造通缩。</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-indigo-400 mb-1">30%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">国库储备</div>
          <p className="text-xs mt-2 text-slate-500">存入DAO国库，用于开发与生态建设。</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-amber-400 mb-1">20%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">节点激励</div>
          <p className="text-xs mt-2 text-slate-500">奖励给维护网络安全的验证者。</p>
        </div>
      </div>

      <h4 className="font-bold text-white mt-6 mb-2">4.2 代币分配 (STP)</h4>
      <p className="mb-4 text-sm text-slate-400">代币总量：100,000,000 (1亿) 枚</p>
      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">45%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{width: '45%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">社区空投与激励</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">20%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{width: '20%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">生态基金</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">15%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{width: '15%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">核心团队 (锁仓)</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">10%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full" style={{width: '10%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">投资机构 (锁仓)</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">10%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-slate-500 h-2 rounded-full" style={{width: '10%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">DAO国库</div>
        </div>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">5.</span> 市场应用场景
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">大额OTC交易</h4>
          <p className="text-sm text-slate-400">陌生人之间的点对点大额交易，无需信任第三方担保。</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">电商购物</h4>
          <p className="text-sm text-slate-400">买家确认收货后再放款，卖家看到资金锁定再发货。</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">企业薪资发放</h4>
          <p className="text-sm text-slate-400">防止财务发错地址，提供二次确认机会。</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">防误操作保护</h4>
          <p className="text-sm text-slate-400">为日常转账多加一层“撤回”保险，安心无忧。</p>
        </div>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">6.</span> 发展路线图
      </h3>
      <div className="relative border-l border-slate-700 ml-3 space-y-6 pl-6 py-2">
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-white">Q1 2025</h4>
          <p className="text-sm text-slate-400 mt-1">发布白皮书，上线测试网，启动社区空投活动。</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q2 2025</h4>
          <p className="text-sm text-slate-500 mt-1">主网上线（支持ETH, BNB, Polygon），开启交易挖矿。</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q3 2025</h4>
          <p className="text-sm text-slate-500 mt-1">推出多签安全账户功能，发布移动端App。</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q4 2025</h4>
          <p className="text-sm text-slate-500 mt-1">启动DAO治理，通过社区投票调整协议参数。</p>
        </div>
      </div>
    </section>
  </div>
);

export const WhitepaperContentEn = () => (
  <div className="space-y-8 text-slate-300">
    <div className="text-center border-b border-white/10 pb-8">
      <h1 className="text-3xl font-bold text-white mb-2">Secure Transfer Protocol Whitepaper</h1>
      <p className="text-blue-400 font-medium">A Secure, Trusted, and Reversible Next-Gen Blockchain Protocol</p>
    </div>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">1.</span> Abstract
      </h3>
      <p className="leading-relaxed">
        The On-Chain Escrow Transfer Protocol is a non-custodial blockchain asset transfer solution built on smart contracts. This protocol aims to solve the core pain point of blockchain transactions being "irreversible and high-risk," providing an extra layer of security for all individual and enterprise users. We do not take custody of user funds; instead, we implement "on-chain time locks" and "two-way confirmation" mechanisms through code logic, completely eliminating transfer anxiety.
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">2.</span> Problem Statement
      </h3>
      <p className="leading-relaxed mb-4">
        The nature of blockchain technology dictates immutability and irreversibility. While this is the cornerstone of security, it also brings significant risks. A single typo in a transfer address results in permanent loss; funds sent to scam addresses cannot be recovered. According to security statistics, billions of dollars in assets are lost annually due to operational errors and fraud.
      </p>
      <div className="bg-slate-800/50 p-4 rounded-xl border-l-4 border-rose-500">
        <p className="text-sm">
          Existing solutions like traditional Escrow often rely on centralized services (like exchanges), which are costly and carry "black box" risks (funds can be frozen or misappropriated). We need a completely decentralized, transparent, "code is law" on-chain security mechanism.
        </p>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">3.</span> Solution: On-Chain Security
      </h3>
      
      <h4 className="font-bold text-white mt-4 mb-2">3.1 Core Concepts</h4>
      <p className="mb-4">We deconstruct the traditional "transfer = complete" mechanism into a three-stage process:</p>
      <ul className="space-y-3">
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[4rem]">Lock</span>
          <span>Sender sends funds to the protocol's smart contract. Funds are no longer controlled by the sender but haven't reached the receiver yet.</span>
        </li>
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[4rem]">Confirm</span>
          <span>Receiver sees the pending transaction on the frontend, verifies amount and source, and clicks "Confirm Receive".</span>
        </li>
        <li className="flex gap-3 bg-slate-800/30 p-3 rounded-lg">
          <span className="font-bold text-blue-400 min-w-[4rem]">Execute</span>
          <span>Funds are formally transferred to the receiver. During this period, the sender has "Regret Rights" and can withdraw funds anytime before confirmation.</span>
        </li>
      </ul>

      <h4 className="font-bold text-white mt-6 mb-2">3.2 Technical Architecture</h4>
      <p className="leading-relaxed">
        The protocol layer is fully open-source and runs on EVM-compatible chains. Core components:
      </p>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
        <li><strong className="text-slate-200">Smart Contracts:</strong> Handle escrow logic, strictly audited, no backdoors.</li>
        <li><strong className="text-slate-200">Frontend DApp:</strong> Intuitive UI, connect wallet to use, no server-side private key storage.</li>
        <li><strong className="text-slate-200">Event Listener:</strong> Off-chain indexing service for real-time status notifications.</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">4.</span> Tokenomics & Governance
      </h3>
      
      <h4 className="font-bold text-white mt-4 mb-2">4.1 Protocol Fees</h4>
      <p className="mb-4">The protocol charges a tiny service fee (e.g., 0.1% or fixed amount) for each successful secure transfer:</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-emerald-400 mb-1">50%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Burn</div>
          <p className="text-xs mt-2 text-slate-500">Buyback and burn STP tokens to create deflation.</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-indigo-400 mb-1">30%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Treasury</div>
          <p className="text-xs mt-2 text-slate-500">Deposited into DAO treasury for dev & ecosystem.</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-amber-400 mb-1">20%</div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Incentives</div>
          <p className="text-xs mt-2 text-slate-500">Rewards for validators maintaining network security.</p>
        </div>
      </div>

      <h4 className="font-bold text-white mt-6 mb-2">4.2 Token Distribution (STP)</h4>
      <p className="mb-4 text-sm text-slate-400">Total Supply: 100,000,000 (100M)</p>
      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">45%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{width: '45%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">Community & Airdrop</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">20%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{width: '20%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">Ecosystem Fund</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">15%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{width: '15%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">Team (Locked)</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">10%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-amber-500 h-2 rounded-full" style={{width: '10%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">Investors (Locked)</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="w-24 font-bold text-slate-200">10%</div>
          <div className="flex-1 px-3">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-slate-500 h-2 rounded-full" style={{width: '10%'}}></div>
            </div>
          </div>
          <div className="w-32 text-right text-slate-400">DAO Treasury</div>
        </div>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">5.</span> Use Cases
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">Large OTC Trades</h4>
          <p className="text-sm text-slate-400">P2P large transfers between strangers without trusted third parties.</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">E-commerce</h4>
          <p className="text-sm text-slate-400">Buyers release funds after confirmation; Sellers ship after seeing locked funds.</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">Payroll</h4>
          <p className="text-sm text-slate-400">Prevent sending salaries to wrong addresses with a second confirmation.</p>
        </div>
        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <h4 className="font-bold text-white mb-1">Anti-Error Protection</h4>
          <p className="text-sm text-slate-400">An extra "Undo" layer for daily transfers.</p>
        </div>
      </div>
    </section>

    <section>
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-blue-500">6.</span> Roadmap
      </h3>
      <div className="relative border-l border-slate-700 ml-3 space-y-6 pl-6 py-2">
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-blue-500 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-white">Q1 2025</h4>
          <p className="text-sm text-slate-400 mt-1">Whitepaper Release, Testnet Launch, Community Airdrop.</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q2 2025</h4>
          <p className="text-sm text-slate-500 mt-1">Mainnet Launch (ETH, BNB, Polygon), Trade Mining.</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q3 2025</h4>
          <p className="text-sm text-slate-500 mt-1">Multi-sig Secure Accounts, Mobile App Release.</p>
        </div>
        <div className="relative">
          <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-900"></div>
          <h4 className="font-bold text-slate-300">Q4 2025</h4>
          <p className="text-sm text-slate-500 mt-1">DAO Governance Launch, Community Voting.</p>
        </div>
      </div>
    </section>
  </div>
);
