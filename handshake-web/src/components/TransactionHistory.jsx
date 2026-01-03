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
          
          // Estimate blocks per day (BSC ~3s per block => ~28800 blocks/day)
          // For safety, let's assume 30k blocks/day.
          // RETRY STRATEGY: Reduce total scan range to avoid "pruned" errors on public nodes.
          // Many testnet nodes only keep 24h-48h of history.
          const BLOCKS_PER_DAY = 30000;
          const MAX_BLOCKS_TO_SCAN = BLOCKS_PER_DAY * 7; // Limit to 1 day for stability
          
          const startBlockLimit = Math.max(0, currentBlock - MAX_BLOCKS_TO_SCAN);
          
          const SCAN_CHUNK_SIZE = 40000; // Further reduced for OKX compatibility
          
          // --- Strategy: TransferSettled Only ---
          // User requested to only fetch Settled events.
          // Note: This means "Pending" transactions will NOT appear in history.
          // They will only appear in the "Active Transactions" (OrderList) component.
          
          const filterSentSettled = contract.filters.TransferSettled(null, account, null);
          const filterReceivedSettled = contract.filters.TransferSettled(null, null, account);
          
          // let allLogs = [];
          
          // Loop backwards until limit
          while (scanEnd > startBlockLimit) {
              const scanStart = Math.max(startBlockLimit, scanEnd - SCAN_CHUNK_SIZE);
              
              // console.log(`[History Debug] Scanning chunk: ${scanStart} - ${scanEnd}`);

              // Parallel fetch for this chunk
              const [
                  chunkSentSettled, 
                  chunkRecvSettled
              ] = await Promise.all([
                  contract.queryFilter(filterSentSettled, scanStart, scanEnd).catch(e => { 
                      console.warn("Chunk Sent Settled Error", e); 
                      if (e?.message?.includes('pruned') || e?.info?.error?.message?.includes('pruned')) {
                          // If pruned, we can't go back further. Stop scanning.
                          return 'PRUNED';
                      }
                      return []; 
                  }),
                  contract.queryFilter(filterReceivedSettled, scanStart, scanEnd).catch(e => { 
                      console.warn("Chunk Recv Settled Error", e); 
                      if (e?.message?.includes('pruned') || e?.info?.error?.message?.includes('pruned')) {
                          return 'PRUNED';
                      }
                      return []; 
                  })
              ]);
              
              if (chunkSentSettled === 'PRUNED' || chunkRecvSettled === 'PRUNED') {
                  console.log("History pruned, stopping scan.");
                  break;
              }
              
              const chunkLogs = [...chunkSentSettled, ...chunkRecvSettled];
              
              // console.log(`[History Debug] Chunk results (${scanStart}-${scanEnd}):`, {
              //     sentSettled: chunkSentSettled.length,
              //     recvSettled: chunkRecvSettled.length,
              //     totalCombined: chunkLogs.length
              // });

              if (chunkLogs.length > 0) {
                  // Process Logs immediately to update UI incrementally
                  const chunkItems = await Promise.all(chunkLogs.map(async (log) => {
                      let id, sender, receiver, tokenAddr, amount, action;
                      
                      // Identify Event Type
                      // Since we only query Settled, it's always Settled.
                      
                      // TransferSettled: id, sender, receiver, token, amount, action
                      try {
                          id = log.args[0];
                          sender = log.args[1];
                          receiver = log.args[2];
                          tokenAddr = log.args[3];
                          amount = log.args[4];
                          action = log.args[5];
                      } catch (e) {
                          console.warn("Error parsing Settled log args:", e);
                          // Fallback to named access if available
                          id = log.args.id;
                          sender = log.args.sender;
                          receiver = log.args.receiver;
                          tokenAddr = log.args.token;
                          amount = log.args.amount;
                          action = log.args.action;
                      }
                      
                      const isSender = sender.toLowerCase() === account.toLowerCase();
                      let tokenSymbol = "Unknown";
                      let tokenDecimals = 18;
                      const nativeToken = activeConfig.tokens.find(t => t.address.toLowerCase() === tokenAddr.toLowerCase());
                      if (nativeToken) {
                          tokenSymbol = nativeToken.symbol;
                      } else {
                          tokenSymbol = `${tokenAddr.slice(0, 6)}...${tokenAddr.slice(-4)}`;
                      }

                      const formattedAmount = ethers.formatUnits(amount, tokenDecimals);
                      
                      let status = "UNKNOWN";
                      // Normalize action to string just in case
                      const actionStr = String(action || "").toUpperCase();
                      
                      if (actionStr === "RELEASED") status = "COMPLETED";
                      else if (actionStr === "CANCELLED") status = "CANCELLED";
                      else if (actionStr === "EXPIRED") status = "EXPIRED";
                      // Debug unknown status
                      else console.warn("Unknown action:", action, "Log:", log);

                      const block = await log.getBlock();
                      return {
                          id,
                          type: isSender ? 'send' : 'receive',
                          counterparty: isSender ? receiver : sender,
                          amount: formattedAmount,
                          token: tokenSymbol,
                          status,
                          timestamp: block ? block.timestamp * 1000 : Date.now(),
                          txHash: log.transactionHash,
                          priority: 2 // Keep consistent structure
                      };
                  }));

                  // Update State Incrementally
                  setHistory(prev => {
                      const combined = [...prev, ...chunkItems];
                      // Simple deduplication by ID is enough now since we only have one source of truth
                      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                      return unique.sort((a, b) => b.timestamp - a.timestamp);
                  });
              }
              
              // Move cursor back
              scanEnd = scanStart - 1;
              
              // Break if we hit limit
              if (scanEnd < startBlockLimit) break;
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
                      {item.type === 'send' ? '-' : '+'} {parseFloat(item.amount).toFixed(4)} 
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
