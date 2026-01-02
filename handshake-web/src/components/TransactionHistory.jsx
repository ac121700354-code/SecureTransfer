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

  // Constants for pagination
  const CHUNK_SIZE = 2000; // Reduced from 5000 to avoid RPC limits
  const MIN_ITEMS_PER_PAGE = 5;

  // Reset history when account or network changes
  useEffect(() => {
    setHistory([]);
    setLastScannedBlock(null);
    setHasMore(true);
    setError(null);
  }, [account, activeConfig]);

  const fetchHistoryChunk = async (fromBlock, toBlock, contract, currentAccount) => {
      // --- Simplified Strategy: Directly Scan TransferSettled ---
      // This is efficient and naturally excludes PENDING orders.
      // Assumes the contract emits TransferSettled with indexed user parameters.
      
      const filterSent = contract.filters.TransferSettled(null, currentAccount, null);
      const filterReceived = contract.filters.TransferSettled(null, null, currentAccount);
      
      const [sentLogs, receivedLogs] = await Promise.all([
        contract.queryFilter(filterSent, fromBlock, toBlock),
        contract.queryFilter(filterReceived, fromBlock, toBlock)
      ]);
      
      const allLogs = [...sentLogs, ...receivedLogs];
      if (allLogs.length === 0) return [];

      const items = await Promise.all(allLogs.map(async (log) => {
          // Args: [id, sender, receiver, token, amount, action]
          // Note: Be careful with args access. 
          // If contract ABI has indexed params, they might be in different positions in `args` array vs non-indexed.
          // But ethers v6 normalizes this in `args`.
          
          let id, sender, receiver, tokenAddr, amount, action;
          
          // Safe destructuring based on expected ABI
          if (log.args.length >= 6) {
              id = log.args[0];
              sender = log.args[1];
              receiver = log.args[2];
              tokenAddr = log.args[3];
              amount = log.args[4];
              action = log.args[5];
          } else {
              // Fallback for older ABI or weird cases (e.g. Sepolia old contract)
              // We try to access by name if available
              id = log.args.id || log.args[0];
              sender = log.args.sender || log.args[1];
              receiver = log.args.receiver || log.args[2];
              // Adjust for potential index shifts if some are not indexed in old ABI?
              // Actually, queryFilter only works if we filter by indexed topics.
              // If we found logs using filter(null, currentAccount), it means currentAccount matched an indexed topic.
              
              tokenAddr = log.args.token || log.args[3];
              amount = log.args.amount || log.args[4];
              action = log.args.action || log.args[5] || "UNKNOWN";
          }
          
          const isSender = sender.toLowerCase() === currentAccount.toLowerCase();
          
          let tokenSymbol = "Unknown";
          let tokenDecimals = 18;
          const nativeToken = activeConfig.tokens.find(t => t.address === tokenAddr);
          if (nativeToken) tokenSymbol = nativeToken.symbol;

          const formattedAmount = ethers.formatUnits(amount, tokenDecimals);
          
          // Map action to Status
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
      return items;
  };

  const loadMore = useCallback(async (isInitial = false) => {
    if (!account || !provider || !activeConfig) return;
    if (loading || loadingMore) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    
    try {
      let runner = provider;
      if (provider && !provider.call && provider.request) {
          runner = new ethers.BrowserProvider(provider);
      }
      const escrowAddress = activeConfig.contracts.EscrowProxy.address;
      const escrowAbi = activeConfig.contracts.EscrowProxy.abi;
      const contract = new ethers.Contract(escrowAddress, escrowAbi, runner);

      let currentEnd = lastScannedBlock;
      // If isInitial is true, force fetching the latest block number to restart scan from top
      if (isInitial || currentEnd === null) {
          currentEnd = await runner.getBlockNumber();
      }

      let newItems = [];
      let scanCursor = currentEnd;
      let chunksScanned = 0;

      // Scan backwards until we find items or hit limit (3 chunks or genesis)
      while (newItems.length < MIN_ITEMS_PER_PAGE && scanCursor > 0 && chunksScanned < 3) {
          const currentStart = Math.max(0, scanCursor - CHUNK_SIZE);
          // console.log(`Scanning ${currentStart} to ${scanCursor}`);
          
          const chunkItems = await fetchHistoryChunk(currentStart, scanCursor, contract, account);
          
          newItems = [...newItems, ...chunkItems];
          
          scanCursor = currentStart - 1;
          chunksScanned++;
      }

      // Filter out duplicates just in case
      setHistory(prev => {
          const combined = [...prev, ...newItems];
          // Unique by ID
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => b.timestamp - a.timestamp);
      });

      setLastScannedBlock(scanCursor);
      if (scanCursor <= 0) setHasMore(false);
      
    } catch (err) {
      console.error("Failed to load history:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [account, provider, activeConfig, lastScannedBlock, loading, loadingMore]);


  // Initial load
  useEffect(() => {
      // Only load if empty and no scan cursor set (fresh start)
      if (lastScannedBlock === null && account) {
          loadMore(true);
      }
  }, [account, activeConfig]); // Dependency on loadMore removed to avoid loop, handled by refs/state if needed, but safe here

  // Silent refresh logic (optional: re-fetch latest chunk?)
  // For pagination, "refresh" usually means reloading the top page.
  // We can just re-scan the "latest" to "lastScannedBlock" range if we wanted to be perfect,
  // but simpler to just do nothing or reset. 
  // Let's reset on manual refresh trigger.
  useEffect(() => {
    if (refreshTrigger) {
       // Reset and reload
       setHistory([]);
       setLastScannedBlock(null);
       setHasMore(true);
       // We need a way to trigger loadMore after state update. 
       // Effect dependency on lastScannedBlock might be tricky.
       // Let's just manually call a "resetAndLoad" logic.
       // Actually, setting lastScannedBlock to null will trigger the effect above? 
       // No, because loadMore is not in dependency.
       // Let's rely on the effect [account, activeConfig] for network switches.
       // For refreshTrigger, we do manual:
       setTimeout(() => {
           setLastScannedBlock(null); // Reset cursor
           // But we need to clear history first to avoid dups or UI glitch? 
           // Actually, standard "Refresh" in pagination context often means "Reload from top".
       }, 0);
    }
  }, [refreshTrigger]);
  
  // Re-trigger load when lastScannedBlock becomes null via refresh? 
  // Let's just make a specific effect for it.
  useEffect(() => {
      if (refreshTrigger && lastScannedBlock === null) {
          loadMore(true);
      }
  }, [refreshTrigger, lastScannedBlock]);


  if (!account) return null;

  return (
    <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6 mt-8 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <FaHistory className="text-blue-400" />
          {t.transactionHistory || "Transaction History"}
        </h3>
        <button 
          onClick={() => { setHistory([]); setLastScannedBlock(null); setHasMore(true); setTimeout(() => loadMore(true), 10); }} 
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
          
          {hasMore && (
              <div className="py-4 text-center border-t border-white/5">
                  <button 
                    onClick={() => loadMore(false)} 
                    disabled={loadingMore}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                  >
                      {loadingMore ? <FaSpinner className="animate-spin" /> : null}
                      {loadingMore ? t.loadingHistory : t.loadMoreHistory}
                  </button>
              </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default TransactionHistory;
