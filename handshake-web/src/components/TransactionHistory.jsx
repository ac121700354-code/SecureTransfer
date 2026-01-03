import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaHistory, FaArrowUp, FaArrowDown, FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaExternalLinkAlt, FaSpinner, FaSync } from 'react-icons/fa';
import { useLanguage } from '../App';

const TransactionHistory = ({ account, provider, chainId, activeConfig, refreshTrigger }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastScannedBlock, setLastScannedBlock] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Reset history when account or network changes
  useEffect(() => {
    setHistory([]);
    setLastScannedBlock(null);
    setHasMore(true);
    setError(null);
    // Initial fetch of all history
    fetchAllHistory();
  }, [account, activeConfig]);

  // Fetch all history from block 0 to latest
  const fetchAllHistory = async () => {
      if (!account || !provider || !activeConfig) return;
      setLoading(true);
      setError(null);

      try {
          let runner = provider;
          if (provider && !provider.call && provider.request) {
              runner = new ethers.BrowserProvider(provider);
          }
          const escrowAddress = activeConfig.contracts.EscrowProxy.address;
          const escrowAbi = activeConfig.contracts.EscrowProxy.abi;
          const contract = new ethers.Contract(escrowAddress, escrowAbi, runner);

          // Use a simple 0 to latest range
          // If this fails on public RPCs due to range limit, we would need chunking.
          // But user requested "Directly load all".
          // UPDATE: User wants "Load All" but RPC limits block range to 50k.
          // Solution: Auto-scan backwards in chunks of 40k until block 0.
          
          const currentBlock = await runner.getBlockNumber();
          let scanEnd = currentBlock;
          const SCAN_CHUNK_SIZE = 40000; // Safe margin below 50k
          
          // --- Strategy A: TransferSettled (New Contract / Indexed) ---
          const filterSent = contract.filters.TransferSettled(null, account, null);
          const filterReceived = contract.filters.TransferSettled(null, null, account);
          
          let allSettledLogs = [];
          
          // Loop backwards until 0
          while (scanEnd > 0) {
              const scanStart = Math.max(0, scanEnd - SCAN_CHUNK_SIZE);
              
              // Parallel fetch for this chunk
              const [chunkSent, chunkRecv] = await Promise.all([
                  contract.queryFilter(filterSent, scanStart, scanEnd).catch(e => { console.warn("Chunk Sent Error", e); return []; }),
                  contract.queryFilter(filterReceived, scanStart, scanEnd).catch(e => { console.warn("Chunk Recv Error", e); return []; })
              ]);
              
              const chunkLogs = [...chunkSent, ...chunkRecv];
              
              if (chunkLogs.length > 0) {
                  // Process Logs immediately to update UI incrementally
                  const chunkItems = await Promise.all(chunkLogs.map(async (log) => {
                      let id, sender, receiver, tokenAddr, amount, action;
                      if (log.args.length >= 6) {
                          [id, sender, receiver, tokenAddr, amount, action] = log.args;
                      } else {
                          id = log.args.id || log.args[0];
                          sender = log.args.sender || log.args[1];
                          receiver = log.args.receiver || log.args[2];
                          tokenAddr = log.args.token || log.args[3];
                          amount = log.args.amount || log.args[4];
                          action = log.args.action || log.args[5] || "UNKNOWN";
                      }
                      
                      const isSender = sender.toLowerCase() === account.toLowerCase();
                      let tokenSymbol = "Unknown";
                      let tokenDecimals = 18;
                      const nativeToken = activeConfig.tokens.find(t => t.address === tokenAddr);
                      if (nativeToken) tokenSymbol = nativeToken.symbol;

                      const formattedAmount = ethers.formatUnits(amount, tokenDecimals);
                      
                      let status = "UNKNOWN";
                      if (action === "RELEASED") status = "COMPLETED";
                      else if (action === "CANCELLED") status = "CANCELLED";
                      else if (action === "EXPIRED") status = "EXPIRED";

                      const block = await log.getBlock();
                      return {
                          id,
                          type: isSender ? 'send' : 'receive',
                          counterparty: isSender ? receiver : sender,
                          amount: formattedAmount,
                          token: tokenSymbol,
                          status,
                          timestamp: block ? block.timestamp * 1000 : Date.now(),
                          txHash: log.transactionHash
                      };
                  }));

                  // Update State Incrementally
                  setHistory(prev => {
                      const combined = [...prev, ...chunkItems];
                      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                      return unique.sort((a, b) => b.timestamp - a.timestamp);
                  });
              }
              
              // Move cursor back
              scanEnd = scanStart - 1;
              
              // Optional: Break if we hit genesis or some logical limit (e.g. contract deployment block if known)
              if (scanEnd < 0) break;
          }
          
          // Finished scanning all blocks
          // State is already updated incrementally
          
          // (Removed old monolithic query logic)
          /*
          const [settledSent, settledRecv] = await Promise.all([
              contract.queryFilter(filterSent, fromBlock, toBlock).catch(e => { console.warn("SettledSent Error", e); return []; }),
              contract.queryFilter(filterReceived, fromBlock, toBlock).catch(e => { console.warn("SettledRecv Error", e); return []; })
          ]);
          
          console.log("Logs found:", { 
              settledSent: settledSent.length, 
              settledRecv: settledRecv.length
          });

          const allSettledLogs = [...settledSent, ...settledRecv];

          // Process Settled Logs
          const settledItems = await Promise.all(allSettledLogs.map(async (log) => {
              // ...
          }));

          // Unique and Sort
          const unique = Array.from(new Map(settledItems.map(item => [item.id, item])).values());
          unique.sort((a, b) => b.timestamp - a.timestamp);
          
          setHistory(unique);
          */

      } catch (err) {
          console.error("Failed to fetch history", err);
          setError(err.message || "Failed to load history");
      } finally {
          setLoading(false);
      }
  };

  // Trigger refresh
  useEffect(() => {
    if (refreshTrigger) {
        fetchAllHistory();
    }
  }, [refreshTrigger]);


  if (!account) return null;

  return (
    <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6 mt-8 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <FaHistory className="text-blue-400" />
          {t.transactionHistory || "Transaction History"}
        </h3>
        <button 
          onClick={() => { fetchAllHistory(); }} 
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          title="Reload"
        >
          <FaSync className={`${loading ? 'animate-spin text-blue-400' : ''}`} size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && history.length === 0 ? (
          <div className="text-center py-10 text-slate-500">{t.loadingHistory}</div>
        ) : error ? (
          <div className="text-center py-10 text-rose-500">Error: {error}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-slate-500">{t.noTransactionHistory}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                <th className="pb-3 pl-2">{t.type}</th>
                <th className="pb-3">{t.counterparty}</th>
                <th className="pb-3">{t.amount}</th>
                <th className="pb-3">{t.status}</th>
                <th className="pb-3">{t.time}</th>
                <th className="pb-3 text-right pr-6">{t.link}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {history.map((item) => (
                <tr key={item.id} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                  <td className="py-4 pl-2">
                    <div className={`flex items-center gap-2 font-bold ${item.type === 'send' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.type === 'send' ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
                        {item.type === 'send' ? t.sent : t.received}
                    </div>
                  </td>
                  <td className="py-4 font-mono text-slate-400">
                    {item.counterparty.slice(0, 6)}...{item.counterparty.slice(-4)}
                  </td>
                  <td className="py-4 font-bold">
                    <span className={item.type === 'send' ? 'text-rose-400' : 'text-emerald-400'}>
                      {item.type === 'send' ? '-' : '+'}{parseFloat(item.amount).toFixed(4)} 
                    </span>
                    <span className="text-xs text-slate-500 font-normal ml-1">{item.token}</span>
                  </td>
                  <td className="py-4">
                    <span className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                        ${item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : ''}
                        ${item.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                        ${item.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : ''}
                        ${item.status === 'EXPIRED' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' : ''}
                        ${item.status === 'UNKNOWN' ? 'bg-slate-500/10 text-slate-400' : ''}
                    `}>
                        {item.status === 'COMPLETED' && <FaCheckCircle />}
                        {item.status === 'PENDING' && <FaClock />}
                        {item.status === 'CANCELLED' && <FaBan />}
                        {item.status === 'EXPIRED' && <FaTimesCircle />}
                        {item.status === 'COMPLETED' ? t.statusCompleted : 
                         item.status === 'PENDING' ? t.statusPending : 
                         item.status === 'CANCELLED' ? t.statusCancelled : 
                         item.status === 'EXPIRED' ? t.statusExpired : 
                         item.status}
                    </span>
                  </td>
                  <td className="py-4 text-slate-500 text-xs">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="py-4 text-right pr-6">
                    <a 
                        href={`${activeConfig.explorer || '#'}?tx=${item.txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity inline-flex justify-end"
                    >
                        <FaExternalLinkAlt size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
};

export default TransactionHistory;
