import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import InitiateTransfer from './InitiateTransfer';
import OrderList from './OrderList';
import { FaWallet, FaShieldAlt, FaSignOutAlt, FaExchangeAlt } from 'react-icons/fa';
import { ToastProvider, useToast } from './components/Toast';

// 内部组件：ConnectButton (为了使用 useToast)
const ConnectButton = ({ account, handleConnect, handleDisconnect }) => {
  const toast = useToast();
  
  const onConnect = async (isSwitching) => {
    try {
      await handleConnect(isSwitching);
      // toast.success("Wallet connected!"); // 可选
    } catch (e) {
      toast.error(e.message || "Connection failed");
    }
  };

  if (account) {
    return (
      <div className="flex items-center bg-slate-800/50 border border-white/5 rounded-full p-1 pl-4 pr-1 shadow-sm transition-all hover:bg-slate-800">
        <div className="flex flex-col items-end mr-3 leading-tight">
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Connected</span>
           <span className="text-sm font-mono text-blue-400 font-semibold">{account.slice(0, 6)}...{account.slice(-4)}</span>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onConnect(true)} 
            title="Switch Wallet"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white transition-all"
          >
            <FaExchangeAlt size={12} />
          </button>
          <button 
            onClick={handleDisconnect} 
            title="Disconnect"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white transition-all"
          >
            <FaSignOutAlt size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button 
      onClick={() => onConnect(false)}
      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all font-semibold text-sm shadow-lg shadow-blue-600/20 flex items-center gap-2"
    >
      <FaWallet /> Connect Wallet
    </button>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center text-rose-400">
          <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
          <p className="font-mono text-xs bg-slate-900 p-4 rounded-xl inline-block text-left">
            {this.state.error && this.state.error.toString()}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="block mx-auto mt-6 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white text-sm"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [account, setAccount] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  // ... (handleConnect 等逻辑保持不变)
  const handleConnect = useCallback(async (isSwitching = false) => {
    if (!window.ethereum) return alert("请安装 MetaMask！");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      if (isSwitching) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      if (error.code === 4001) {
        console.log("用户取消了操作");
      } else {
        console.error("连接/切换失败:", error);
      }
    }
  }, []);

  const handleDisconnect = () => {
    setAccount("");
    console.log("已从前端断开连接");
  };

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setRefreshTrigger(prev => prev + 1);
        } else {
          setAccount("");
        }
      };

      const handleChainChanged = () => window.location.reload();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const onTransactionSuccess = (order) => {
    // 如果有具体的订单对象，直接传递给 OrderList 进行本地更新
    // 否则（order 为空或 undefined），触发全量刷新
    setRefreshTrigger(order || (prev => (typeof prev === 'number' ? prev + 1 : 1)));
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">
          {/* ... (导航栏保持不变) ... */}
          <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/5">
            <div className="max-w-7xl mx-auto flex justify-between items-center h-20 px-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                  <img src="/tokens/bfr-logo.svg?v=12" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">SecureTransfer</h1>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Decentralized Transfer Protocol</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ConnectButton 
                  account={account} 
                  handleConnect={handleConnect} 
                  handleDisconnect={handleDisconnect} 
                />
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-6 px-6 py-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 backdrop-blur-sm">
               <h4 className="text-blue-400 font-bold text-sm mb-1.5 flex items-center gap-2">
                 <FaShieldAlt /> Security Notice
               </h4>
               <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                  <p>
                    <strong className="text-slate-300">Escrow Mechanism:</strong> Funds are securely locked in the smart contract upon initiation. You retain full control to <span className="text-blue-400 font-medium">Release</span> the payment or <span className="text-slate-300 font-medium">Cancel</span> to retrieve your funds at any time.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 border-t border-blue-500/10 pt-2">
                    <li>For safety, ensure the receiver sees the pending order in their <strong>Inbox</strong> before you release the funds.</li>
                    <li>If the receiver cannot find the transaction record, please double-check the recipient wallet address.</li>
                  </ul>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 space-y-8">
                <div className="sticky top-28">
                   <ErrorBoundary>
                      <InitiateTransfer 
                        account={account} 
                        onTransactionSuccess={onTransactionSuccess} 
                        refreshBalanceTrigger={refreshTrigger}
                        activeCount={activeCount}
                      />
                   </ErrorBoundary>
              </div>
            </div>

              <div className="lg:col-span-8">
                {account ? (
                  <ErrorBoundary>
                    <OrderList 
                        key={account} 
                        account={account} 
                        refreshTrigger={refreshTrigger} 
                        onActionSuccess={() => setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1))}
                        onStatsUpdate={setActiveCount}
                    />
                  </ErrorBoundary>
                ) : (
                  <div className="h-[550px] flex flex-col items-center justify-center bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-700/50">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                      <FaWallet className="text-3xl text-slate-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">Wallet Not Connected</h3>
                    <p className="text-slate-500 text-sm max-w-xs text-center">Please connect your wallet to view your active transactions and history.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}