import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaInbox, FaSignOutAlt, FaSync, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';

const CONTRACT_ADDRESS = config.contracts.EscrowProxy.address;
const ABI = config.contracts.EscrowProxy.abi;

const KNOWN_TOKENS = {
  [ethers.ZeroAddress]: "BNB",
  [config.contracts.BufferToken.address.toLowerCase()]: "BFR",
  "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd": "USDT",
  "0x64544969ed7ebf5f083679233325356ebe738930": "USDC"
};

const OrderCard = ({ order, isOut, onAction, processingState }) => {
  const isThisProcessing = processingState?.id === order.id;
  const processingAction = isThisProcessing ? processingState.action : null;

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
      const normalized = addr.toLowerCase();
      if (KNOWN_TOKENS[normalized]) return KNOWN_TOKENS[normalized];
      return "Unknown";
  };

  const formatDate = (ts) => {
    if (!ts) return "--";
    return new Date(Number(ts) * 1000).toLocaleString();
  };

  const Countdown = ({ targetTimestamp }) => {
    const [timeLeft, setTimeLeft] = useState("");
    
    useEffect(() => {
      const update = () => {
        const now = Math.floor(Date.now() / 1000);
        const diff = Number(targetTimestamp) - now;
        
        if (diff <= 0) {
          setTimeLeft("Expired");
          return;
        }
        
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        
        if (d > 0) setTimeLeft(`${d}d ${h}h`);
        else if (h > 0) setTimeLeft(`${h}h ${m}m`);
        else setTimeLeft(`${m}m ${s}s`);
      };
      
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }, [targetTimestamp]);

    return <span>{timeLeft}</span>;
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
                 {(isOut ? order.receiver : order.sender)}
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

               {Number(order.expiresAt) > 0 && (
                 <div className="ml-auto flex flex-col items-end">
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">Expires In</span>
                    <span className="text-[9px] text-slate-500 font-mono"><Countdown targetTimestamp={order.expiresAt} /></span>
                 </div>
               )}
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
            {processingAction === 'confirm' ? <FaHourglassHalf className="animate-spin" /> : <FaCheckCircle />} Release
          </button>
          <button 
            onClick={() => onAction(order.id, 'cancel')}
            disabled={!!processingState}
            className="py-2 bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {processingAction === 'cancel' ? <FaHourglassHalf className="animate-spin" /> : <FaTimesCircle />} Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default function OrderList({ account, refreshTrigger, onActionSuccess, onStatsUpdate }) {
  const toast = useToast();
  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [activeTab, setActiveTab] = useState("inbox"); 
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [processingState, setProcessingState] = useState(null);

  // --- 核心：安全的数据清洗逻辑 ---
  const fetchOrders = useCallback(async () => {
    if (!account || !window.ethereum) return;
    // 注意：这里不再设置 setIsInitialLoading(true)
    // Loading 状态完全由 useEffect 控制，确保刷新操作静默进行
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

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
            // record: [sender, receiver, token, amount, createdAt, expiresAt]
            return {
              id: id,
              sender: record[0],
              receiver: record[1],
              token: record[2],
              amount: record[3],
              createdAt: record[4],
              expiresAt: record[5]
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
  }, [account]);

  // 1. 初始化或账户变化时：拉取数据
  // 仅当列表完全为空时才显示 Loading，防止闪烁
  useEffect(() => {
    if (account) {
      if (inbox.length === 0 && outbox.length === 0) {
         setIsInitialLoading(true);
      }
      fetchOrders().finally(() => setIsInitialLoading(false));
    }
  }, [account, fetchOrders]); // 注意：这里不应该依赖 inbox/outbox，否则会死循环。但因为我们只在 mount/account change 时触发，所以没问题。

  // 等等，fetchOrders 是依赖 account 的。
  // 但是 useEffect 闭包里读不到最新的 inbox/outbox 吗？
  // 不，useEffect 的依赖数组决定了它何时运行。
  // 如果我们想在 fetchOrders 运行时判断，应该在 fetchOrders 内部判断，或者使用 ref。
  
  // 更好的做法：
  // 移除 useEffect 中的 setIsInitialLoading(true)
  // 改为在 fetchOrders 内部判断：如果数据为空，则 set(true)


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
        fetchOrders(); 
    }
  }, [refreshTrigger, fetchOrders]);

  // --- 核心：安全的操作处理逻辑 ---
  const handleAction = async (id, method) => {
    if (processingState) return; // 防止双重点击
    setProcessingState({ id, action: method });
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      
      const currentSigner = await signer.getAddress();
      console.log(`Action: ${method} by ${currentSigner}`);

      const tx = await contract[method](id);
      await tx.wait(); 

      // 替换 alert 为 toast
      toast.success(method === 'cancel' ? "Order Cancelled Successfully" : "Funds Released Successfully");

      // 乐观更新
      setInbox(prev => prev.filter(item => item.id !== id));
      setOutbox(prev => prev.filter(item => item.id !== id));

      if (onActionSuccess) onActionSuccess();

    } catch (err) {
      console.error("Action error:", err);
      const reason = err.reason || (err.message.includes("Only sender") ? "只有发起人可以操作" : "Transaction Failed");
      toast.error(reason);
    } finally {
      setProcessingState(null);
    }
  };

  const sortedInbox = [...inbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const sortedOutbox = [...outbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  return (
    <div className="bg-slate-900/20 rounded-[2.5rem] border border-white/5 overflow-hidden h-[550px] flex flex-col">
      <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-800/20">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
           <FaInbox className="text-blue-500" /> Transaction History
        </h3>
      </div>

      {/* List Content */}
      {isInitialLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
          <FaSync className="animate-spin text-2xl opacity-20" />
          <p className="text-xs font-medium animate-pulse">Syncing with blockchain...</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Inbox Section */}
          <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Receive <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedInbox.length}</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-0 flex flex-col">
              {sortedInbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-800/20">
                  <p className="text-xs text-slate-600">No received transactions</p>
                </div>
              ) : (
                sortedInbox.map(o => (
                  <OrderCard 
                    key={o.id} 
                    order={o} 
                    isOut={false} 
                    onAction={handleAction}
                    processingState={processingState}
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
                Send <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedOutbox.length}</span>
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-0 flex flex-col">
              {sortedOutbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-800/20">
                  <p className="text-xs text-slate-600">No sent transactions</p>
                </div>
              ) : (
                sortedOutbox.map(o => (
                  <OrderCard 
                    key={o.id} 
                    order={o} 
                    isOut={true} 
                    onAction={handleAction}
                    processingState={processingState}
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