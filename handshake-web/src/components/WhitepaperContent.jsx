import React from 'react';
import { FaLock, FaCheckCircle, FaExchangeAlt, FaShieldAlt, FaCode, FaBell, FaChartPie, FaGlobe, FaMobileAlt, FaVoteYea } from 'react-icons/fa';

const SectionTitle = ({ number, title }) => (
  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 border-b border-white/5 pb-2">
    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-mono border border-blue-500/20">{number}</span>
    <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{title}</span>
  </h3>
);

const ProcessCard = ({ icon: Icon, title, desc, step }) => (
  <div className="relative flex-1 bg-slate-800/40 border border-white/5 rounded-xl p-5 hover:border-blue-500/30 transition-all group">
    <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:text-blue-400 group-hover:border-blue-500/50 transition-colors">
      {step}
    </div>
    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform duration-300">
      <Icon size={20} />
    </div>
    <h4 className="font-bold text-white mb-2">{title}</h4>
    <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
  </div>
);

const FeatureList = ({ items }) => (
  <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
    {items.map((item, idx) => (
      <li key={idx} className="bg-slate-800/30 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
        <div className="mb-3 text-slate-400">{item.icon}</div>
        <strong className="text-slate-200 block mb-1">{item.title}</strong>
        <span className="text-xs text-slate-500">{item.desc}</span>
      </li>
    ))}
  </ul>
);

const TokenBar = ({ label, percent, colorClass, width }) => (
  <div className="flex items-center text-sm group">
    <div className="w-28 font-bold text-slate-300 group-hover:text-white transition-colors">{percent}</div>
    <div className="flex-1 px-4">
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner">
        <div className={`h-full rounded-full ${colorClass} relative`} style={{width}}>
            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12 translate-x-[-150%]"></div>
        </div>
      </div>
    </div>
    <div className="w-36 text-right text-slate-400 group-hover:text-slate-300 transition-colors">{label}</div>
  </div>
);

export const WhitepaperContentZh = () => (
  <div className="space-y-12 text-slate-300 font-sans">
    <div className="text-center border-b border-white/10 pb-10">
      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">链上安全转账协议白皮书</h1>
      <p className="text-blue-400 font-medium text-lg tracking-wide opacity-90">安全 · 可信 · 可撤回</p>
      <p className="text-slate-500 text-sm mt-2">下一代去中心化非托管资产传输标准</p>
    </div>

    <section>
      <SectionTitle number="01" title="摘要" />
      <div className="bg-slate-800/20 p-6 rounded-2xl border border-white/5 leading-relaxed text-justify">
        链上安全转账协议（On-Chain Secure Transfer Protocol）是一项基于智能合约构建的非托管式区块链资产转账解决方案。本协议旨在解决区块链交易“不可逆、高风险”的核心痛点，为所有个人与企业用户提供一层额外的安全交易保障。我们不托管用户资金，而是通过代码逻辑实现了“链上时间锁”和“双向确认”机制，彻底消除转账焦虑。
      </div>
    </section>

    <section>
      <SectionTitle number="02" title="问题陈述" />
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
             不可逆风险
          </h4>
          <p className="text-sm leading-relaxed text-slate-400">
            区块链技术的特性决定了其不可篡改与不可逆性。一笔转账如果输错地址，就永久丢失；遭到诈骗诱导转账，资金也无法追回。据行业安全机构统计，每年因误操作和欺诈导致的链上资产损失高达数十亿美元。
          </p>
        </div>
        <div className="bg-slate-800/40 p-5 rounded-xl border-l-2 border-rose-500/50">
          <h4 className="font-bold text-slate-200 mb-2 text-sm">现有方案局限性</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            传统的担保交易（Escrow）往往依赖中心化服务商（如交易所），不仅成本高昂，且存在“黑箱”风险（资金可能被冻结或挪用）。我们需要一种完全去中心化的、透明的链上安全机制。
          </p>
        </div>
      </div>
    </section>

    <section>
      <SectionTitle number="03" title="解决方案" />
      
      <h4 className="font-bold text-white mb-6 pl-1 border-l-4 border-blue-500">3.1 核心流程</h4>
      <div className="flex flex-col md:flex-row gap-4 relative">
         <ProcessCard 
            step="1"
            icon={FaLock}
            title="锁定 (Lock)"
            desc="付款方发起转账，资金进入智能合约锁定。此时资金安全托管，尚未到达收款方账户。"
         />
         <div className="hidden md:flex items-center text-slate-600">
            <FaExchangeAlt />
         </div>
         <ProcessCard 
            step="2"
            icon={FaBell}
            title="核对 (Verify)"
            desc="收款方在平台查询订单。若能查到，通知付款方无异常；若查不到，通知付款方异常。"
         />
         <div className="hidden md:flex items-center text-slate-600">
            <FaExchangeAlt />
         </div>
         <ProcessCard 
            step="3"
            icon={FaCheckCircle}
            title="执行 (Execute)"
            desc="若无异常，付款方操作“放款”，资金即刻到账；若有异常，付款方操作“撤回”，资金原路退回。"
         />
      </div>

      <h4 className="font-bold text-white mt-10 mb-4 pl-1 border-l-4 border-purple-500">3.2 技术架构</h4>
      <FeatureList items={[
        { icon: <FaCode size={24} />, title: "智能合约", desc: "负责资金托管逻辑，经过严格审计" },
        { icon: <FaGlobe size={24} />, title: "前端 DApp", desc: "直观界面，连接钱包即可使用" },
        { icon: <FaShieldAlt size={24} />, title: "安全审计", desc: "多重签名与时间锁保护" }
      ]} />
    </section>

    <section>
      <SectionTitle number="04" title="经济模型" />
      
      <h4 className="font-bold text-white mt-4 mb-2">4.1 协议服务费</h4>
      <p className="mb-4">协议将对每笔成功完成的安全转账收取微量服务费（如 0.1% 或固定金额），用于：</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 max-w-3xl mx-auto">
        {/* 90% Burn */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group shadow-xl shadow-emerald-500/5 hover:border-emerald-500/20 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <div className="text-4xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-500">90%</div>
          <div className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-2">回购销毁</div>
          <p className="text-xs text-slate-400 leading-relaxed">大部分协议收入用于在二级市场回购 STP 并销毁，实现持续通缩，提升代币价值。</p>
        </div>

        {/* 10% DAO */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group shadow-xl shadow-blue-500/5 hover:border-blue-500/20 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <div className="text-4xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-500">10%</div>
          <div className="text-xs text-blue-400 uppercase tracking-widest font-bold mb-2">DAO 财库</div>
          <p className="text-xs text-slate-400 leading-relaxed">进入 DAO 财库钱包，用于支持社区治理提案、长期生态激励及项目可持续发展。</p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between items-end mb-6">
            <h4 className="font-bold text-white">代币分配 (STP)</h4>
            <span className="text-xs text-slate-500 font-mono">代币总量：100,000,000 (1亿)</span>
        </div>
        <div className="space-y-5">
            <TokenBar label="社区空投与激励" percent="45%" width="45%" colorClass="bg-gradient-to-r from-blue-600 to-blue-400" />
            <TokenBar label="生态基金" percent="20%" width="20%" colorClass="bg-gradient-to-r from-purple-600 to-purple-400" />
            <TokenBar label="核心团队 (锁仓)" percent="15%" width="15%" colorClass="bg-gradient-to-r from-emerald-600 to-emerald-400" />
            <TokenBar label="投资机构 (锁仓)" percent="10%" width="10%" colorClass="bg-gradient-to-r from-amber-600 to-amber-400" />
            <TokenBar label="DAO 国库" percent="10%" width="10%" colorClass="bg-gradient-to-r from-slate-600 to-slate-400" />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle number="05" title="应用场景" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
            { title: "大额 OTC 交易", desc: "陌生人之间的点对点大额交易，无需信任第三方担保。" },
            { title: "企业薪资发放", desc: "防止财务发错地址，提供二次确认机会。" },
            { title: "防误操作保护", desc: "为日常转账多加一层“撤回”保险，安心无忧。" }
        ].map((item, i) => (
            <div key={i} className="bg-slate-800/30 p-5 rounded-xl border border-white/5 hover:bg-slate-800/60 hover:border-blue-500/20 transition-all cursor-default">
                <h4 className="font-bold text-slate-200 mb-1">{item.title}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
        ))}
      </div>
    </section>

    <section>
      <SectionTitle number="06" title="路线图" />
      <div className="relative ml-3 pl-8 py-2 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-slate-700 before:to-slate-800">
        {[
            { time: "Q1 2026", title: "起步", desc: "发布白皮书，上线测试网，启动社区空投活动。", active: true },
            { time: "Q2 2026", title: "主网", desc: "主网上线（支持ETH, BNB），STP开启交易。", active: false },
            { time: "Q3 2026", title: "生态", desc: "推出多签安全账户功能，发布移动端App。", active: false },
            { time: "Q4 2026", title: "治理", desc: "启动DAO治理，通过社区投票调整协议参数。", active: false }
        ].map((item, i) => (
            <div key={i} className="relative group">
                <div className={`absolute -left-[39px] w-6 h-6 rounded-full border-4 border-slate-900 ${item.active ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-700'} transition-colors`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-1">
                    <span className={`text-sm font-bold font-mono ${item.active ? 'text-blue-400' : 'text-slate-500'}`}>{item.time}</span>
                    <h4 className={`font-bold ${item.active ? 'text-white' : 'text-slate-300'}`}>{item.title}</h4>
                </div>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors">{item.desc}</p>
            </div>
        ))}
      </div>
    </section>
  </div>
);

export const WhitepaperContentEn = () => (
  <div className="space-y-12 text-slate-300 font-sans">
    <div className="text-center border-b border-white/10 pb-10">
      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Secure Transfer Protocol Whitepaper</h1>
      <p className="text-blue-400 font-medium text-lg tracking-wide opacity-90">Secure · Trusted · Reversible</p>
      <p className="text-slate-500 text-sm mt-2">Next-Generation Decentralized Non-Custodial Transfer Standard</p>
    </div>

    <section>
      <SectionTitle number="01" title="Abstract" />
      <div className="bg-slate-800/20 p-6 rounded-2xl border border-white/5 leading-relaxed text-justify">
        The On-Chain Escrow Transfer Protocol is a non-custodial blockchain asset transfer solution built on smart contracts. This protocol aims to solve the core pain point of blockchain transactions being "irreversible and high-risk," providing an extra layer of security for all individual and enterprise users. We do not take custody of user funds; instead, we implement "on-chain time locks" and "two-way confirmation" mechanisms through code logic, completely eliminating transfer anxiety.
      </div>
    </section>

    <section>
      <SectionTitle number="02" title="Problem Statement" />
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold text-white mb-3 flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
             Irreversibility Risk
          </h4>
          <p className="text-sm leading-relaxed text-slate-400">
            The nature of blockchain technology dictates immutability and irreversibility. A single typo in a transfer address results in permanent loss; funds sent to scam addresses cannot be recovered. According to security statistics, billions of dollars in assets are lost annually due to operational errors and fraud.
          </p>
        </div>
        <div className="bg-slate-800/40 p-5 rounded-xl border-l-2 border-rose-500/50">
          <h4 className="font-bold text-slate-200 mb-2 text-sm">Limitations of Existing Solutions</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Existing solutions like traditional Escrow often rely on centralized services (like exchanges), which are costly and carry "black box" risks (funds can be frozen or misappropriated). We need a completely decentralized, transparent on-chain security mechanism.
          </p>
        </div>
      </div>
    </section>

    <section>
      <SectionTitle number="03" title="Solution" />
      
      <h4 className="font-bold text-white mb-6 pl-1 border-l-4 border-blue-500">3.1 Core Workflow</h4>
      <div className="flex flex-col md:flex-row gap-4 relative">
         <ProcessCard 
            step="1"
            icon={FaLock}
            title="Lock"
            desc="Payer initiates transfer, funds are locked in smart contract. Funds are secured and haven't reached Payee yet."
         />
         <div className="hidden md:flex items-center text-slate-600">
            <FaExchangeAlt />
         </div>
         <ProcessCard 
            step="2"
            icon={FaBell}
            title="Verify"
            desc="Payee queries the order. If found, Payee notifies Payer 'All Good'; if not found, Payee notifies 'Abnormal'."
         />
         <div className="hidden md:flex items-center text-slate-600">
            <FaExchangeAlt />
         </div>
         <ProcessCard 
            step="3"
            icon={FaCheckCircle}
            title="Execute"
            desc="If verified, Payer clicks 'Release' to transfer funds; if abnormal, Payer clicks 'Withdraw' to retrieve funds."
         />
      </div>

      <h4 className="font-bold text-white mt-10 mb-4 pl-1 border-l-4 border-purple-500">3.2 Architecture</h4>
      <FeatureList items={[
        { icon: <FaCode size={24} />, title: "Smart Contracts", desc: "Handles escrow logic, strictly audited" },
        { icon: <FaGlobe size={24} />, title: "Frontend DApp", desc: "Intuitive UI, connect wallet to use" },
        { icon: <FaShieldAlt size={24} />, title: "Security Audit", desc: "Multi-sig & Time-lock protection" }
      ]} />
    </section>

    <section>
      <SectionTitle number="04" title="Tokenomics" />
      
      <h4 className="font-bold text-white mt-4 mb-2">4.1 Protocol Fees</h4>
      <p className="mb-4">The protocol charges a small fee (e.g. 0.1%) on every successful secured transfer, which is used for:</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 max-w-3xl mx-auto">
        {/* 90% Burn */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group shadow-xl shadow-emerald-500/5 hover:border-emerald-500/20 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <div className="text-4xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-500">90%</div>
          <div className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-2">Buyback & Burn</div>
          <p className="text-xs text-slate-400 leading-relaxed">The majority of protocol revenue is used to buy back STP tokens from the secondary market and burn them, achieving continuous deflation.</p>
        </div>

        {/* 10% DAO */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 text-center relative overflow-hidden group shadow-xl shadow-blue-500/5 hover:border-blue-500/20 transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <div className="text-4xl font-bold text-white mb-2 group-hover:scale-110 transition-transform duration-500">10%</div>
          <div className="text-xs text-blue-400 uppercase tracking-widest font-bold mb-2">DAO Treasury</div>
          <p className="text-xs text-slate-400 leading-relaxed">Allocated to the DAO Treasury wallet to support community governance proposals, long-term incentives, and sustainable development.</p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between items-end mb-6">
            <h4 className="font-bold text-white">Token Distribution (STP)</h4>
            <span className="text-xs text-slate-500 font-mono">Total Supply: 100,000,000</span>
        </div>
        <div className="space-y-5">
            <TokenBar label="Community & Airdrop" percent="45%" width="45%" colorClass="bg-gradient-to-r from-blue-600 to-blue-400" />
            <TokenBar label="Ecosystem Fund" percent="20%" width="20%" colorClass="bg-gradient-to-r from-purple-600 to-purple-400" />
            <TokenBar label="Team (Locked)" percent="15%" width="15%" colorClass="bg-gradient-to-r from-emerald-600 to-emerald-400" />
            <TokenBar label="Investors (Locked)" percent="10%" width="10%" colorClass="bg-gradient-to-r from-amber-600 to-amber-400" />
            <TokenBar label="DAO Treasury" percent="10%" width="10%" colorClass="bg-gradient-to-r from-slate-600 to-slate-400" />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle number="05" title="Use Cases" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
            { title: "Large OTC Trades", desc: "P2P large transfers between strangers without trusted third parties." },
            { title: "Payroll", desc: "Prevent sending salaries to wrong addresses with a second confirmation." },
            { title: "Anti-Error Protection", desc: "An extra 'Undo' layer for daily transfers." }
        ].map((item, i) => (
            <div key={i} className="bg-slate-800/30 p-5 rounded-xl border border-white/5 hover:bg-slate-800/60 hover:border-blue-500/20 transition-all cursor-default">
                <h4 className="font-bold text-slate-200 mb-1">{item.title}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
        ))}
      </div>
    </section>

    <section>
      <SectionTitle number="06" title="Roadmap" />
      <div className="relative ml-3 pl-8 py-2 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-slate-700 before:to-slate-800">
        {[
            { time: "Q1 2026", title: "Inception", desc: "Whitepaper Release, Testnet Launch, Community Airdrop.", active: true },
            { time: "Q2 2026", title: "Mainnet", desc: "Mainnet Launch (ETH, BNB), Trade Mining.", active: false },
            { time: "Q3 2026", title: "Ecosystem", desc: "Multi-sig Secure Accounts, Mobile App Release.", active: false },
            { time: "Q4 2026", title: "Governance", desc: "DAO Governance Launch, Community Voting.", active: false }
        ].map((item, i) => (
            <div key={i} className="relative group">
                <div className={`absolute -left-[39px] w-6 h-6 rounded-full border-4 border-slate-900 ${item.active ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-700'} transition-colors`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-1">
                    <span className={`text-sm font-bold font-mono ${item.active ? 'text-blue-400' : 'text-slate-500'}`}>{item.time}</span>
                    <h4 className={`font-bold ${item.active ? 'text-white' : 'text-slate-300'}`}>{item.title}</h4>
                </div>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors">{item.desc}</p>
            </div>
        ))}
      </div>
    </section>
  </div>
);
