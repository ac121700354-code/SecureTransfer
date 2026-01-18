import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaInbox, FaSignOutAlt, FaSync, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';
import { useLanguage } from './contexts/LanguageContext';
import ConfirmModal from './components/ConfirmModal';

// Note: CONTRACT_ADDRESS is now dynamic, we get it inside the component.

const OrderCard = ({ order, isOut, onAction, processingState, contracts, tokensConfig }) => {
  const isThisProcessing = processingState?.id === order.id;
  const processingAction = isThisProcessing ? processingState.action : null;
  const { t } = useLanguage();

  const safeFormat = (val) => {
    try {
      if (val === null || val === undefined) return "0.00";
      // 格式化为18位小数的字符串
      const formatted = ethers.formatUnits(val, 18);
      // 截取逻辑：
      // 1. 查找小数点
      const dotIndex = formatted.indexOf('.');
      if (dotIndex === -1) return formatted; // 没有小数
      
      // 2. 截取整数部分 + 小数点 + 最多8位小数
      // 如果小数位数不足8位，直接返回原值（不补0，保持简洁）
      // 如果超过8位，直接截断
      return formatted.slice(0, dotIndex + 9); // +9 因为包括小数点本身
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
    <div className={`p-3 rounded-xl mb-2 transition-all duration-300 group bg-white/5 border border-white/5
      ${isThisProcessing ? 'opacity-50 scale-[0.98]' : 'hover:bg-white/10'}`}>
      
      {/* Header: Type, Address, Time */}
      <div className={`flex items-center w-full ${isOut ? 'mb-2' : ''}`}>
        <div className="flex items-center gap-3 w-full">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ring-1 ring-white/5 shrink-0
            ${isOut ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isOut ? <FaSignOutAlt /> : <FaInbox />}
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-between">
             <div className="flex flex-col gap-0.5">
                {/* Address */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <span className="font-mono text-white tracking-wide">
                    {(isOut ? order.receiver : order.sender).slice(0, 6)}...{(isOut ? order.receiver : order.sender).slice(-4)}
                  </span>
                </div>
                {/* Time */}
                <div className="text-[10px] text-slate-500 font-medium text-left ml-0.5">
                   {formatDate(order.createdAt)}
                </div>
             </div>

             {/* Amount + Token */}
             <div className="flex items-center gap-2">
                <span className={`text-sm font-bold tracking-tight leading-none ${isOut ? 'text-rose-400' : 'text-emerald-400'}`} title={safeFormat(order.totalAmount || order.amount)}>
                  {isOut ? "-" : "+"} {safeFormat(order.totalAmount || order.amount)}
                </span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                   {getTokenName(order.token)}
                </span>
             </div>
         </div>
       </div>
     </div>

      {/* Actions */}
      {isOut ? (
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
      ) : (
        <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-amber-400/80 flex items-center justify-end gap-1.5 font-medium leading-tight">
           {t.inboxTip}
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
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    orderId: null,
    method: null
  });

  // --- 核心：安全的数据清洗逻辑 ---
  const fetchOrders = useCallback(async () => {
    if (!account || !contracts || !activeConfig?.rpcUrl) return;
    
    try {
      // Use JsonRpcProvider to view data from the selected network, regardless of wallet state
      const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
      const contract = new ethers.Contract(contracts.SecureHandshakeUnlimitedInbox.address, contracts.SecureHandshakeUnlimitedInbox.abi, provider);

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
            // record: [sender, receiver, token, amount, totalAmount, createdAt]
            
            return {
              id: id,
              sender: record[0],
              receiver: record[1],
              token: record[2],
              amount: record[3],
              totalAmount: record[4], // 从合约直接读取原始金额
              createdAt: record[5],
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

      // 安全更新：只有在成功获取数据后才更新状态
      // 如果出错，上面的 Promise.all 会抛出异常，进入 catch 块，从而保留旧数据
      setInbox(inRecs);
      setOutbox(outRecs);
      if (onStatsUpdate) onStatsUpdate(outRecs.length);
    } catch (err) {
      console.error("Fetch error:", err);
      // 可选：在这里可以弹出一个 Toast 提示用户“网络错误，显示的是缓存数据”
      // 但绝对不要 setInbox([])
    } finally {
      setIsInitialLoading(false);
    }
  }, [account, contracts, onStatsUpdate]);

  // 1. 初始化或账户变化时：拉取数据
  // 强制显示 Loading
  useEffect(() => {
    if (account && contracts) {
       // 注意：如果想在账户切换时先清空数据（避免看到别人的数据），这里可以保留清空。
       // 但如果是为了防止“网络错误导致清空”，我们只应该在 fetchOrders 内部保护。
       // 这里为了用户体验（不看别人数据），切换账户时必须清空。
       setInbox([]);
       setOutbox([]);
       setIsInitialLoading(true);
       fetchOrders().finally(() => setIsInitialLoading(false));
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
        // 这里不需要清空数据，直接 fetch，如果失败，fetchOrders 内部的 catch 会捕获，不会覆盖现有数据
        if (contracts) {
          fetchOrders(); 
        }
    }
  }, [refreshTrigger, fetchOrders, contracts]);

  // 监听 activeConfig 变化（网络切换），强制显示 Loading
  useEffect(() => {
    // 网络切换时，旧数据肯定是错的（不同链），所以必须清空
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

    // Add confirmation for 'confirm' (Release Funds) action
    if (method === 'confirm') {
      setConfirmModal({
        isOpen: true,
        orderId: id,
        method: method
      });
      return;
    }
    
    // For other actions (like cancel), proceed directly
    executeAction(id, method);
  };

  const executeAction = async (id, method) => {
    setProcessingState({ id, action: method });
    
    try {
      // 必须使用 BrowserProvider 来获取签名者，而不是 JsonRpcProvider
      const provider = new ethers.BrowserProvider(walletProvider || window.ethereum);
      
      // Ensure wallet is on the selected network
      const network = await provider.getNetwork();
      
      // Fix: Compare chainIds as BigInt or Strings to avoid type mismatch issues (1 vs 97n)
      if (network.chainId.toString() !== chainId.toString()) {
          try {
              await provider.send("wallet_switchEthereumChain", [{ chainId: "0x" + BigInt(chainId).toString(16) }]);
          } catch (e) {
              throw new Error("Please switch to the correct network to proceed.");
          }
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contracts.SecureHandshakeUnlimitedInbox.address, contracts.SecureHandshakeUnlimitedInbox.abi, signer);
      
      const currentSigner = await signer.getAddress();
      console.log(`Action: ${method} by ${currentSigner}`);

      const tx = await contract[method](id);
      await tx.wait(); 

      // 替换 alert 为 toast
      toast.success(method === 'cancel' ? t.cancelled : t.transactionInitiated);

      // 乐观更新
      setInbox(prev => prev.filter(item => item.id !== id));
      setOutbox(prev => {
          const newState = prev.filter(item => item.id !== id);
          if (onStatsUpdate) onStatsUpdate(newState.length);
          return newState;
      });

      // if (onActionSuccess) onActionSuccess(); // Disable auto-refresh to prevent race conditions with RPC latency


    } catch (err) {
      console.error("Action error:", err);
      const reason = err.reason || (err.message.includes("Only sender") ? t.transactionFailed : t.transactionFailed);
      toast.error(reason);
    } finally {
      setProcessingState(null);
    }
  };

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [inboxPage, setInboxPage] = useState(1);
  const [outboxPage, setOutboxPage] = useState(1);
  const inboxPageSize = 4;
  const outboxPageSize = 4;
  const pageSize = 4; // Fallback for safety if needed elsewhere

  const handleManualRefresh = async () => {
    if (isManualRefreshing || isInitialLoading) return;
    setIsManualRefreshing(true);
    await fetchOrders();
    setIsManualRefreshing(false);
  };

  const sortedInbox = [...inbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const sortedOutbox = [...outbox].sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  const totalInboxPages = Math.ceil(sortedInbox.length / inboxPageSize) || 1;
  const totalOutboxPages = Math.ceil(sortedOutbox.length / outboxPageSize) || 1;
  
  // Auto-adjust pages if items are removed and current page is empty
  useEffect(() => {
    if (inboxPage > totalInboxPages && totalInboxPages > 0) {
        setInboxPage(totalInboxPages);
    }
  }, [totalInboxPages, inboxPage]);

  useEffect(() => {
    if (outboxPage > totalOutboxPages && totalOutboxPages > 0) {
        setOutboxPage(totalOutboxPages);
    }
  }, [totalOutboxPages, outboxPage]);

  const currentInbox = sortedInbox.slice((inboxPage - 1) * inboxPageSize, inboxPage * inboxPageSize);
  const currentOutbox = sortedOutbox.slice((outboxPage - 1) * outboxPageSize, outboxPage * outboxPageSize);

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
    <div className="bg-slate-900/20 rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col h-[724px]">
      <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-800/20">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
           <FaInbox className="text-blue-500" /> {t.history}
        </h3>
        <button
          onClick={handleManualRefresh}
          disabled={isManualRefreshing || isInitialLoading}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50"
          title={t.refresh || "Refresh"}
        >
          <FaSync className={`${isManualRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List Content */}
      {isInitialLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4 min-h-[400px]">
          <FaSync className="animate-spin text-2xl opacity-20" />
          <p className="text-xs font-medium animate-pulse">{t.processing}</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Outbox Section */}
          <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                {t.sender} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedOutbox.length}</span>
              </h4>
            </div>
            <div className="p-5 pt-0 flex flex-col h-full overflow-hidden">
              {sortedOutbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600">{t.noActiveOrders}</p>
                </div>
              ) : (
                <>
                    {currentOutbox.map(o => (
                    <div key={o.id}>
                        <OrderCard 
                            order={o} 
                            isOut={true} 
                            onAction={handleAction}
                            processingState={processingState}
                            contracts={contracts}
                            tokensConfig={activeConfig?.tokens}
                        />
                    </div>
                    ))}
                    {/* Fillers - Height must match OrderCard height approx 126px */}
                    {Array.from({ length: Math.max(0, outboxPageSize - currentOutbox.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-[126px] mb-2"></div>
                    ))}
                </>
              )}
            </div>
            <PaginationControls page={outboxPage} total={totalOutboxPages} setPage={setOutboxPage} />
          </div>

          {/* Inbox Section */}
          <div className="flex flex-col h-full min-h-0">
            <div className="p-5 pb-3 shrink-0 bg-slate-800/10 backdrop-blur-sm sticky top-0 z-10 h-[52px] flex items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {t.receiver} <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{sortedInbox.length}</span>
              </h4>
            </div>
            <div className="p-5 pt-0 flex flex-col h-full overflow-hidden">
              {sortedInbox.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <p className="text-xs text-slate-600">{t.noActiveOrders}</p>
                </div>
              ) : (
                <>
                  {currentInbox.map(o => (
                    <div key={o.id}>
                        <OrderCard 
                        order={o} 
                        isOut={false} 
                        onAction={handleAction}
                        processingState={processingState}
                        contracts={contracts}
                        tokensConfig={activeConfig?.tokens}
                        />
                    </div>
                  ))}
                  {/* Fillers */}
                  {Array.from({ length: Math.max(0, inboxPageSize - currentInbox.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-[126px] mb-2"></div>
                  ))}
                </>
              )}
            </div>
            <PaginationControls page={inboxPage} total={totalInboxPages} setPage={setInboxPage} />
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
            executeAction(confirmModal.orderId, confirmModal.method);
            setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={t.confirmReleaseTitle}
        description={t.confirmReleaseDesc}
        confirmText={t.confirmReleaseBtn}
        cancelText={t.cancelReleaseBtn}
      />
    </div>
  );
}