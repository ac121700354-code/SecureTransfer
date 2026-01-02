import React from 'react';
import { FaTimes, FaFileAlt } from 'react-icons/fa';

export default function WhitepaperModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-white/10 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <FaFileAlt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">On-Chain Secure Transfer Protocol Whitepaper</h2>
              <p className="text-xs text-slate-400">A Secure, Trusted, and Reversible Next-Generation Blockchain Transfer Protocol</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar text-slate-300 leading-relaxed space-y-8">
          
          <section>
            <h3 className="text-2xl font-bold text-white mb-4">1. Abstract</h3>
            <p>
              The On-Chain Secure Transfer Protocol is a smart contract-based universal blockchain asset transfer solution. It aims to address the core pain points of existing blockchain transfer operations being "irreversible and error-prone". By introducing a "Lock-Confirm-Settle" transaction flow mechanism, the protocol provides users with a "regret opportunity" for on-chain transfers for the first time, without introducing centralized third parties.
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">2. Problem Statement: The Pain of Irreversibility</h3>
            <p>
              While the decentralized nature of blockchain technology offers transparency, it also brings significant risks. Once a transfer transaction is initiated, the funds are instantly irreversible. Situations such as incorrect address entry, fraudulent transfer requests, and contract interaction errors result in the permanent loss of hundreds of millions of dollars in assets annually.
            </p>
            <p className="mt-2">
              The existing market lacks a native, trustless on-chain transaction protection mechanism.
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">3. Solution: On-Chain Escrow Protocol</h3>
            <div className="pl-4 border-l-2 border-blue-500/30 space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-2">3.1 Core Concept</h4>
                <p>We propose an "On-Chain Escrow" mechanism that decomposes traditional atomic transactions into two steps:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Lock:</strong> The sender locks funds in the smart contract.</li>
                  <li><strong>Confirm:</strong> Within a preset time window, the sender can perform a secondary confirmation.</li>
                  <li><strong>Settle/Withdraw:</strong> Funds are released upon confirmation; if an error is discovered, funds can be fully withdrawn.</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-lg font-bold text-white mb-2">3.2 Key Features</h4>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Non-Custodial:</strong> User funds are always controlled by smart contract logic with no centralized intervention.</li>
                  <li><strong>Universal Compatibility:</strong> Supports native tokens and various ERC20 tokens.</li>
                  <li><strong>Composability:</strong> Standard protocol interfaces can be easily integrated into wallets and dApps.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">4. Economics & Governance Model</h3>
            
            <div className="mb-6">
              <h4 className="text-lg font-bold text-white mb-2">4.1 Transaction Fee Model</h4>
              <p>To ensure the sustainable development of the protocol, we have designed a highly competitive fee model:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Base Fee:</strong> 0.1% (per transaction amount)</li>
                <li><strong>Minimum Fee:</strong> $0.01 USD</li>
                <li><strong>Maximum Cap:</strong> $1.00 USD</li>
              </ul>
              <p className="mt-2 text-sm text-slate-400">Note: Fees will be used for buyback and burn of BFR tokens and protocol treasury reserves.</p>
            </div>

            <div>
              <h4 className="text-lg font-bold text-white mb-2">4.2 Protocol Token BFR</h4>
              <p>BFR is the protocol's native governance token, used for decentralized governance and value capture.</p>
              
              <div className="mt-4 bg-slate-800/50 rounded-xl p-4 overflow-hidden">
                <h5 className="font-bold text-white mb-3 text-sm uppercase tracking-wider">4.2.4 Token Allocation</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-2">Sector</th>
                        <th className="px-4 py-2">Ratio</th>
                        <th className="px-4 py-2">Amount (BFR)</th>
                        <th className="px-4 py-2">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="px-4 py-2 font-medium text-white">Community & Ecosystem</td>
                        <td className="px-4 py-2">40%</td>
                        <td className="px-4 py-2">40,000,000</td>
                        <td className="px-4 py-2">Incentivize early users, airdrops, and ecosystem partnerships.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-white">Liquidity Mining</td>
                        <td className="px-4 py-2">25%</td>
                        <td className="px-4 py-2">25,000,000</td>
                        <td className="px-4 py-2">Initial liquidity incentives for DEXs.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-white">Team & Advisors</td>
                        <td className="px-4 py-2">15%</td>
                        <td className="px-4 py-2">15,000,000</td>
                        <td className="px-4 py-2">Long-term lockup, linear release over 4 years.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-white">Strategic Financing</td>
                        <td className="px-4 py-2">15%</td>
                        <td className="px-4 py-2">15,000,000</td>
                        <td className="px-4 py-2">Early-stage development funding.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-white">DAO Treasury</td>
                        <td className="px-4 py-2">5%</td>
                        <td className="px-4 py-2">5,000,000</td>
                        <td className="px-4 py-2">Reserve funds decided by community voting.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">5. Market Prospects</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                <h4 className="font-bold text-white mb-2">5.1 Target Users</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Large Asset Traders</li>
                  <li>OTC Trading Parties</li>
                  <li>Corporate Financial Payments</li>
                  <li>New Crypto Users</li>
                </ul>
              </div>
              <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                <h4 className="font-bold text-white mb-2">5.2 Competitive Advantages</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Low Gas Consumption (L2 Optimized)</li>
                  <li>Permissionless</li>
                  <li>Instant Withdrawal/Refund</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">6. Roadmap</h3>
            <div className="space-y-4 relative pl-4 border-l border-slate-700">
              <div className="relative">
                <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-slate-900"></div>
                <h4 className="font-bold text-white">Phase 1: Foundation Building (2026 Q1)</h4>
                <p className="text-sm mt-1">Complete core contract development, release Beta version, support ETH/BSC.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-blue-500 rounded-full ring-4 ring-slate-900"></div>
                <h4 className="font-bold text-white">Phase 2: Ecosystem Expansion (2026 Q2)</h4>
                <p className="text-sm mt-1">Integrate more L2 networks (Arbitrum, Optimism), launch BFR token airdrop.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-slate-600 rounded-full ring-4 ring-slate-900"></div>
                <h4 className="font-bold text-white">Phase 3: DAO Governance (2026 Q3-Q4)</h4>
                <p className="text-sm mt-1">Transfer management rights to DAO, start decentralized governance mode.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-bold text-white mb-4">7. Conclusion</h3>
            <p>
              The On-Chain Escrow Transfer Protocol is not just a tool, but a revolution in the Web3 payment experience. By introducing a "reversible" mechanism, we eliminate one of the biggest psychological barriers to mass blockchain adoption—security anxiety. We look forward to building a safer and more user-friendly crypto financial future with the community.
            </p>
          </section>

          <div className="text-center pt-8 border-t border-white/5 text-slate-500 text-sm">
            &copy; 2025 SecureTransfer Protocol. All Rights Reserved.
          </div>

        </div>
      </div>
    </div>
  );
}