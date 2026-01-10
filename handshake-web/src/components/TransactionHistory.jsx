import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaHistory, FaArrowUp, FaArrowDown, FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaExternalLinkAlt, FaSpinner, FaSync, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';

const TransactionHistory = ({ account, provider, chainId, activeConfig, refreshTrigger }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastScannedBlock, setLastScannedBlock] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [sentPage, setSentPage] = useState(1);
  const [receivedPage, setReceivedPage] = useState(1);
  const pageSize = 5;

  // Reset history when account or network changes
  useEffect(() => {
    setHistory([]);
    setLastScannedBlock(null);
    setHasMore(true);
    setError(null);
    setSentPage(1);
    setReceivedPage(1);
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


  const sentHistory = history.filter(h => h.type === 'send');
  const receivedHistory = history.filter(h => h.type !== 'send');
  
  const totalSentPages = Math.ceil(sentHistory.length / pageSize) || 1;
  const totalReceivedPages = Math.ceil(receivedHistory.length / pageSize) || 1;

  const currentSent = sentHistory.slice((sentPage - 1) * pageSize, sentPage * pageSize);
  const currentReceived = receivedHistory.slice((receivedPage - 1) * pageSize, receivedPage * pageSize);

  const HistoryCard = ({ item }) => (
      <div className="bg-slate-800/40 border p-3 rounded-xl mb-2 transition-all duration-300 border-white/5 hover:border-blue-500/20 hover:bg-slate-800/60 h-[74px]">
        <div className="flex items-center gap-3 w-full">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ring-1 ring-white/5 shrink-0
              ${item.type === 'send' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {item.type === 'send' ? <FaArrowUp /> : <FaArrowDown />}
           </div>
           
           <div className="flex-1 min-w-0">
               {/* Top Row: Address + Status */}
               <div className="flex items-center justify-between mb-1">
                  <div className="font-mono text-slate-300 bg-slate-950/30 px-1.5 py-0.5 rounded border border-white/5 text-[10px] tracking-tight">
                     {item.counterparty.slice(0, 6)}...{item.counterparty.slice(-4)}
                  </div>
                  
                  <span className={`
                        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide
                        ${item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                        ${item.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : ''}
                        ${item.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' : ''}
                        ${item.status === 'EXPIRED' ? 'bg-slate-500/10 text-slate-400' : ''}
                    `}>
                        {item.status === 'COMPLETED' && <FaCheckCircle size={8} />}
                        {item.status === 'PENDING' && <FaClock size={8} />}
                        {item.status === 'CANCELLED' && <FaBan size={8} />}
                        {item.status === 'EXPIRED' && <FaTimesCircle size={8} />}
                        <span className="ml-0.5">
                            {item.status === 'COMPLETED' ? t.statusCompleted : 
                             item.status === 'PENDING' ? t.statusPending : 
                             item.status === 'CANCELLED' ? t.statusCancelled : 
                             item.status === 'EXPIRED' ? t.statusExpired : 
                             item.status}
                        </span>
                  </span>
               </div>

               {/* Bottom Row: Time + Amount + Link */}
               <div className="flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-medium">
                     {new Date(item.timestamp).toLocaleString()}
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <span className={`text-xs font-bold ${item.type === 'send' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.type === 'send' ? '-' : '+'} {parseFloat(item.amount).toFixed(4)} 
                        <span className="text-[10px] text-slate-500 font-normal ml-1">{item.token}</span>
                     </span>
                     <a 
                        href={`${activeConfig.explorer || '#'}?tx=${item.txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-blue-400 transition-colors"
                     >
                        <FaExternalLinkAlt size={10} />
                     </a>
                  </div>
               </div>
           </div>
        </div>
      </div>
  );

  const PaginationControls = ({ page, total, setPage }) => (
    <div className="p-3 border-t border-white/5 flex justify-between items-center bg-slate-800/10 mt-auto">
        <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-all"
        >
            <FaChevronLeft size={10} />
        </button>
        <span className="text-[10px] text-slate-500 font-mono">
            {page} / {total}
        </span>
        <button 
            onClick={() => setPage(p => Math.min(total, p + 1))}
            disabled={page >= total}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-all"
        >
            <FaChevronRight size={10} />
        </button>
    </div>
  );

  return (
    <div className="bg-slate-900/20 rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col mt-8">
      <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-800/20">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
        {/* Inbox History */}
        <div className="flex flex-col h-full min-h-0">
             <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {t.received} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{receivedHistory.length}</span>
              </h4>
            </div>
            <div className="p-5 pt-0 flex flex-col h-[420px] overflow-hidden">
                {loading && history.length === 0 ? (
                     <div className="text-center py-10 text-slate-500 text-xs">{t.loadingHistory}</div>
                ) : receivedHistory.length === 0 ? (
                     <div className="text-center py-10 text-slate-500 text-xs">{t.noTransactionHistory}</div>
                ) : (
                    <>
                        {currentReceived.map(item => <HistoryCard key={item.id} item={item} />)}
                        {/* Fill empty space if less than pageSize items to keep layout stable */}
                        {Array.from({ length: Math.max(0, pageSize - currentReceived.length) }).map((_, i) => (
                             <div key={`empty-${i}`} className="h-[74px] mb-2"></div>
                        ))}
                    </>
                )}
            </div>
            <PaginationControls page={receivedPage} total={totalReceivedPages} setPage={setReceivedPage} />
        </div>

        {/* Outbox History */}
        <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                {t.sent} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sentHistory.length}</span>
              </h4>
            </div>
            <div className="p-5 pt-0 flex flex-col h-[420px] overflow-hidden">
                {loading && history.length === 0 ? (
                     <div className="text-center py-10 text-slate-500 text-xs">{t.loadingHistory}</div>
                ) : sentHistory.length === 0 ? (
                     <div className="text-center py-10 text-slate-500 text-xs">{t.noTransactionHistory}</div>
                ) : (
                    <>
                        {currentSent.map(item => <HistoryCard key={item.id} item={item} />)}
                        {Array.from({ length: Math.max(0, pageSize - currentSent.length) }).map((_, i) => (
                             <div key={`empty-${i}`} className="h-[74px] mb-2"></div>
                        ))}
                    </>
                )}
            </div>
            <PaginationControls page={sentPage} total={totalSentPages} setPage={setSentPage} />
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
