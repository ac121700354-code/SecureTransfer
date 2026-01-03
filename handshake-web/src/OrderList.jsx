import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaInbox, FaSignOutAlt, FaSync, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';
import { useLanguage } from './App';

// Note: CONTRACT_ADDRESS is now dynamic, we get it inside the component.

const OrderCard = ({ order, isOut, onAction, processingState, contracts, tokensConfig }) => {
  const isThisProcessing = processingState?.id === order.id;
  const processingAction = isThisProcessing ? processingState.action : null;
  const { t } = useLanguage();

  const safeFormat = (val) => {
    try {
      if (val === null || val === undefined) return "0.00";
      return ethers.formatUnits(val, 18);
    } catch (e) {
      return "0.00";
    }
  };

  const getTokenName = (addr) => {
      if (!addr) return "Unknown";
      
      // Fully rely on tokensConfig
      if (tokensConfig) {
          const token = tokensConfig.find(t => t.address.toLowerCase() === addr.toLowerCase());
          if (token) return token.symbol;
      }

      // Fallback: If not found in config, return short address for debugging
      console.warn("Token not found in config:", addr);
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (ts) => {
    if (!ts) return "--";
    return new Date(Number(ts) * 1000).toLocaleString();
  };

  return (
    <div className={`bg-slate-800/40 border p-4 rounded-2xl mb-3 transition-all duration-300 group hover:bg-slate-800/60
      ${isThisProcessing ? 'opacity-50 border-blue-500/50 scale-[0.98]' : 'border-white/5 hover:border-blue-500/20'}`}>
      
      {/* Header: Type, Address, Time */}
      <div className={`flex items-start w-full ${isOut ? 'mb-4' : ''}`}>
        <div className="flex items-start gap-3 w-full">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ring-1 ring-white/5 shrink-0
            ${isOut ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isOut ? <FaSignOutAlt /> : <FaInbox />}
          </div>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
               <span className="font-mono text-slate-300 bg-slate-950/30 px-1 py-1 rounded border border-white/5 break-all select-all whitespace-nowrap tracking-tight">
                 {(isOut ? order.receiver : order.sender).slice(0, 6)}...{(isOut ? order.receiver : order.sender).slice(-4)}
               </span>
             </div>
             <div className="text-[10px] text-slate-500 font-medium mt-0.5 text-left ml-0.5">
               {formatDate(order.createdAt)}
             </div>

             {/* Amount */}
             <div className={`flex items-end gap-2 mt-3 ml-0.5 ${isOut ? 'mb-1' : ''}`}>
               <span className={`text-2xl font-bold tracking-tight leading-none ${isOut ? 'text-rose-400' : 'text-emerald-400'}`} title={safeFormat(order.amount)}>
                 {isOut ? "-" : "+"} {safeFormat(order.amount)}
               </span>
               <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                 {getTokenName(order.token)}
              </span>
            </div>
         </div>
       </div>
     </div>

      {/* Actions */}
      {isOut && (
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          <button 
            onClick={() => onAction(order.id, 'confirm')}
            disabled={!!processingState}
            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {processingAction === 'confirm' ? <FaHourglassHalf className="animate-spin" /> : <FaCheckCircle />} {t.confirmPayment}
          </button>
          <button 
            onClick={() => onAction(order.id, 'cancel')}
            disabled={!!processingState}
            className="py-2 bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {processingAction === 'cancel' ? <FaHourglassHalf className="animate-spin" /> : <FaTimesCircle />} {t.cancelOrder}
          </button>
        </div>
      )}
    </div>
  );
};

export default function OrderList({ account, provider: walletProvider, refreshTrigger, onActionSuccess, onStatsUpdate, activeConfig, chainId }) {
  const toast = useToast();
  const { t } = useLanguage();
  
  // Note: activeConfig is now passed from App.jsx

  const contracts = activeConfig?.contracts;

  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [processingState, setProcessingState] = useState(null);

  // --- 核心：安全的数据清洗逻辑 ---
  const fetchOrders = useCallback(async () => {
    if (!account || !contracts || !activeConfig?.rpcUrl) return;
    
    try {
      // Use JsonRpcProvider to view data from the selected network, regardless of wallet state
      const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
      const contract = new ethers.Contract(contracts.EscrowProxy.address, contracts.EscrowProxy.abi, provider);

      // 1. 获取 IDs
      const [inIds, outIds] = await Promise.all([
        contract.getInboxIds(account).catch(() => []),
        contract.getOutboxIds(account).catch(() => [])
      ]);


      // 2. 辅助函数：批量获取详情
      const fetchDetails = async (ids) => {
        const details = await Promise.all(ids.map(async (id) => {
          try {
            const record = await contract.activeTransfers(id);
            // record: [sender, receiver, token, amount, createdAt, isConfirmed]
            // Note: Contract now returns 6 values (isConfirmed added back or not removed in ABI?)
            // Actually, based on latest revert, we removed isConfirmed from STRUCT but ABI might still have it if artifacts weren't updated perfectly?
            // Let's check the return value length.
            
            // If we strictly follow the contract we deployed:
            // struct TransferRecord { sender, receiver, token, amount, createdAt }
            // So it returns 5 values.
            
            return {
              id: id,
              sender: record[0],
              receiver: record[1],
              token: record[2],
              amount: record[3],
              createdAt: record[4],
            };
          } catch (e) {
            console.error("Failed to fetch order:", id, e);
            return null;
          }
        }));
        return details.filter(d => d !== null && d.amount > 0n); // 过滤无效或已删除的
      };

      // 3. 获取详情并更新状态
      const [inRecs, outRecs] = await Promise.all([
        fetchDetails(inIds),
        fetchDetails(outIds)
      ]);

      setInbox(inRecs);
      setOutbox(outRecs);
      if (onStatsUpdate) onStatsUpdate(outRecs.length);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsInitialLoading(false);
    }
  }, [account, contracts, onStatsUpdate]);

  // 1. 初始化或账户变化时：拉取数据
  // 强制显示 Loading
  useEffect(() => {
    if (account && contracts) {
       // 无论列表是否为空，只要账户或合约变化，就视为初始化加载，清空并显示 Loading
       setInbox([]);
       setOutbox([]);
       setIsInitialLoading(true);
       fetchOrders().finally(() => setIsInitialLoading(false));

       // Setup polling interval (60 seconds)
       const intervalId = setInterval(() => {
         fetchOrders(); // Silent update
       }, 60000);

       return () => clearInterval(intervalId);
    }
  }, [account, fetchOrders, contracts]); 

  // 2. 收到刷新信号时：静默更新（绝不显示 Loading）
  useEffect(() => {
    if (!refreshTrigger) return;

    // 如果 refreshTrigger 是对象，说明有新订单，手动添加到列表（本地乐观更新）
    if (typeof refreshTrigger === 'object') {
        // 直接添加到 Outbox
        setOutbox(prev => {
            if (prev.some(o => o.id === refreshTrigger.id)) return prev;
            return [refreshTrigger, ...prev];
        });
    } else {
        // 数字信号：静默拉取
        // 注意：如果是网络切换导致的刷新（refreshTrigger 变化且 inbox/outbox 可能为空），
        // 也可以选择在这里设置 loading，但为了体验平滑，我们保持静默更新，
        // 除非列表为空（上面的 useEffect 会处理）
        if (contracts) {
          fetchOrders(); 
        }
    }
  }, [refreshTrigger, fetchOrders, contracts]);

  // 监听 activeConfig 变化（网络切换），强制显示 Loading
  useEffect(() => {
    // 即使 activeConfig 暂时为空（例如不支持的网络），也应该清空数据
    // 只要 activeConfig 发生变化，就意味着环境变了，旧数据必须清除
    setInbox([]);
    setOutbox([]);
    
    if (activeConfig) {
       setIsInitialLoading(true);
       fetchOrders().finally(() => setIsInitialLoading(false));
    } else {
        // 如果不支持该网络，直接停止 Loading（显示空状态）
        setIsInitialLoading(false);
    }
  }, [activeConfig, fetchOrders]);

  // --- 核心：安全的操作处理逻辑 ---
  const handleAction = async (id, method) => {
    if (processingState || !contracts) return; // 防止双重点击
    setProcessingState({ id, action: method });
    
    try {
      // 必须使用 BrowserProvider 来获取签名者，而不是 JsonRpcProvider
      const provider = new ethers.BrowserProvider(walletProvider || window.ethereum);
      
      // Ensure wallet is on the selected network
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) {
          try {
              await provider.send("wallet_switchEthereumChain", [{ chainId: "0x" + chainId.toString(16) }]);
          } catch (e) {
              throw new Error("Please switch to the correct network to proceed.");
          }
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contracts.EscrowProxy.address, contracts.EscrowProxy.abi, signer);
      
      const currentSigner = await signer.getAddress();
      console.log(`Action: ${method} by ${currentSigner}`);

      const tx = await contract[method](id);
      await tx.wait(); 

      // 替换 alert 为 toast
      toast.success(method === 'cancel' ? t.cancelled : t.transactionInitiated);

      // 乐观更新
      setInbox(prev => prev.filter(item => item.id !== id));
      setOutbox(prev => prev.filter(item => item.id !== id));

      if (onActionSuccess) onActionSuccess();

      // 如果是放款操作，触发余额刷新
      if (method === 'confirm' && onActionSuccess) {
          // 这里 onActionSuccess 已经被调用了，它在 App.jsx 中会更新 refreshTrigger
          // 但我们需要确保 InitiateTransfer 组件也能收到信号刷新余额
          // 目前 App.jsx 中的逻辑是：setRefreshTrigger(prev => prev + 1)
          // InitiateTransfer 监听了 refreshBalanceTrigger (即 App.jsx 的 refreshTrigger)
          // 所以理论上余额会自动刷新。
      }

    } catch (err) {
      console.error("Action error:", err);
      const reason = err.reason || (err.message.includes("Only sender") ? t.transactionFailed : t.transactionFailed);
      toast.error(reason);
    } finally {
      setProcessingState(null);
    }
  };

  const sortedInbox = [...inbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const sortedOutbox = [...outbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  return (
    <div className="bg-slate-900/20 rounded-[2.5rem] border border-white/5 overflow-hidden h-[700px] flex flex-col">
      <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-800/20">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
           <FaInbox className="text-blue-500" /> {t.history}
        </h3>
      </div>

      {/* List Content */}
      {isInitialLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
          <FaSync className="animate-spin text-2xl opacity-20" />
          <p className="text-xs font-medium animate-pulse">{t.processing}</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Inbox Section */}
          <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {t.receiver} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedInbox.length}</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-0 flex flex-col">
              {sortedInbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-800/20">
                  <p className="text-xs text-slate-600">{t.noActiveOrders}</p>
                </div>
              ) : (
                sortedInbox.map(o => (
                  <OrderCard 
                    key={o.id} 
                    order={o} 
                    isOut={false} 
                    onAction={handleAction}
                    processingState={processingState}
                    contracts={contracts}
                    tokensConfig={activeConfig?.tokens}
                  />
                ))
              )}
            </div>
          </div>

          {/* Outbox Section */}
          <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                {t.sender} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedOutbox.length}</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-0 flex flex-col">
              {sortedOutbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-800/20">
                  <p className="text-xs text-slate-600">{t.noActiveOrders}</p>
                </div>
              ) : (
                sortedOutbox.map(o => (
                  <OrderCard 
                    key={o.id} 
                    order={o} 
                    isOut={true} 
                    onAction={handleAction}
                    processingState={processingState}
                    contracts={contracts}
                    tokensConfig={activeConfig?.tokens}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}