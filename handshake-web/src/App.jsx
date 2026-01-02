import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import InitiateTransfer from './InitiateTransfer';
import OrderList from './OrderList';
import { FaWallet, FaShieldAlt, FaSignOutAlt, FaExchangeAlt, FaNetworkWired, FaEthereum, FaLayerGroup, FaChevronDown, FaSpinner } from 'react-icons/fa';
import { SiBinance } from 'react-icons/si';
import WalletModal from './components/WalletModal';
import { ToastProvider, useToast } from './components/Toast';
import WhitepaperModal from './components/WhitepaperModal';
import config from './config.json';

// --- Network Switcher Component ---
const NetworkSwitcher = ({ provider, currentChainId, onNetworkChange }) => {
  const [isSwitching, setIsSwitching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const switchNetwork = async (targetChainId) => {
    setIsSwitching(true);
    // 1. Update UI state immediately (User's choice is the source of truth)
    onNetworkChange(targetChainId);
    setIsOpen(false);

    // 2. Try to switch wallet if connected
    if (provider) {
      const targetConfig = config[targetChainId];
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902 && targetConfig) {
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${targetChainId.toString(16)}`,
                  chainName: targetConfig.networkName,
                  rpcUrls: [targetConfig.rpcUrl],
                  blockExplorerUrls: [targetConfig.explorer]
                },
              ],
            });
          } catch (addError) {
            console.error(addError);
          }
        }
      }
    }
    setIsSwitching(false);
  };

  const getNetworkIcon = (chainId, size = 14) => {
    const NETWORK_ICONS = {
      // BNB Chain
      56: { icon: SiBinance, className: "text-[#F0B90B]" },
      97: { icon: SiBinance, className: "text-[#F0B90B]" },
      // Ethereum
      1: { icon: ({ size, className }) => <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" alt="ETH" style={{ width: size, height: size }} className={`rounded-full ${className}`} />, className: "" },
      5: { icon: ({ size, className }) => <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" alt="ETH" style={{ width: size, height: size }} className={`rounded-full ${className}`} />, className: "" },
      11155111: { icon: ({ size, className }) => <img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" alt="ETH" style={{ width: size, height: size }} className={`rounded-full ${className}`} />, className: "" },
      // Arbitrum
      42161: { icon: FaLayerGroup, className: "text-[#2D374B]" },
      421613: { icon: FaLayerGroup, className: "text-[#2D374B]" },
      421614: { icon: FaLayerGroup, className: "text-[#2D374B]" },
    };

    const config = NETWORK_ICONS[chainId];
    if (config) {
      const Icon = config.icon;
      return <Icon size={size} className={config.className} />;
    }
    return <FaNetworkWired size={size} />;
  };

  const currentConfig = config[currentChainId];
  const isSupported = !!currentConfig;
  // const buttonLabel = isSupported ? currentConfig.networkName : "Wrong Network"; // Removed label
  const buttonColorClass = isSupported 
    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20';

  return (
    <div className="relative network-switcher mr-3" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${buttonColorClass}`}
        title={isSupported ? currentConfig.networkName : "Wrong Network"}
      >
        {isSupported ? getNetworkIcon(currentChainId, 18) : <FaNetworkWired size={18} />}
        <FaChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-40 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-left">
           <div className="py-1">
             <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Network</div>
             {Object.keys(config).map((chainId) => {
                const netConfig = config[chainId];
                const cid = parseInt(chainId);
                const isActive = cid === currentChainId;
                return (
                  <button
                    key={chainId}
                    onClick={() => {
                      switchNetwork(cid);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${isActive ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-white/5'}
                    `}
                  >
                    {getNetworkIcon(cid)}
                    <span className="font-medium">{netConfig.networkName}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                  </button>
                );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

// 内部组件：ConnectButton (为了使用 useToast)
const ConnectButton = ({ account, onOpenModal, handleDisconnect, isConnecting }) => {
  const toast = useToast();
  
  if (isConnecting) {
    return (
      <button 
        disabled
        className="px-6 py-2.5 bg-blue-600/50 text-white/80 rounded-full transition-all font-semibold text-sm flex items-center gap-2 cursor-wait"
      >
        <FaSpinner className="animate-spin" /> Connecting...
      </button>
    );
  }
  
  if (account) {
    return (
      <div className="flex items-center bg-slate-800/50 border border-white/5 rounded-full p-1 pl-3 pr-1 shadow-sm transition-all hover:bg-slate-800">
        <div className="flex flex-col items-end mr-2 leading-tight">
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Connected</span>
           <span className="text-sm font-mono text-blue-400 font-semibold">{account.slice(0, 6)}...{account.slice(-4)}</span>
        </div>
        <div className="flex gap-1">
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
      onClick={onOpenModal}
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
  const isManualDisconnect = useRef(false);
  
  // --- Global Network State ---
  const getSavedChainId = () => {
    try {
      const saved = localStorage.getItem('lastChainId');
      if (saved && config[saved]) return parseInt(saved);
    } catch (e) {
      console.error(e);
    }
    return 97; // Default to BNB Testnet
  };

  const [chainId, setChainId] = useState(getSavedChainId());
  const [activeConfig, setActiveConfig] = useState(config[getSavedChainId()] || config[97]);

  const [isInitializing, setIsInitializing] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isWhitepaperOpen, setIsWhitepaperOpen] = useState(false);
  const [walletProvider, setWalletProvider] = useState(window.ethereum);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = useCallback(async (providerObj, walletName) => {
    localStorage.removeItem('isManualDisconnect');
    isManualDisconnect.current = false;
    const targetProvider = providerObj || walletProvider || window.ethereum;
    if (!targetProvider) return alert("Please install a wallet!");
    
    setWalletProvider(targetProvider);
    setIsConnecting(true);

    try {
      const accounts = await targetProvider.request({ method: "eth_requestAccounts" });
      
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        setRefreshTrigger(prev => prev + 1);
        
        // Note: We DO NOT sync chainId here anymore. User selection is master.
      }
    } catch (error) {
      if (error.code === 4001) {
        console.log("User cancelled");
      } else {
        console.error("Connection failed:", error);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [walletProvider]);

  const handleDisconnect = () => {
    localStorage.setItem('isManualDisconnect', 'true');
    isManualDisconnect.current = true;
    setAccount("");
    setWalletProvider(window.ethereum); // Reset to default provider
    console.log("Disconnected from frontend");
  };

  const handleNetworkChange = (id) => {
    setChainId(id);
    setActiveConfig(config[id]);
    localStorage.setItem('lastChainId', id);
    setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1));
  };

  useEffect(() => {
    const provider = walletProvider;
    if (provider) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setRefreshTrigger(prev => prev + 1);
        } else {
          setAccount("");
        }
      };

      const handleChainChanged = (chainIdHex) => {
         // Note: We ignore chain changes from the wallet to keep user's UI selection stable.
         // Unless we want to strictly enforce consistency? 
         // User requested: "subsequent updates should keep user's last choice"
         // So we just log it but don't update state.
         const id = parseInt(chainIdHex, 16);
         console.log("Wallet Chain Changed (Ignored by UI):", id);
         setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1));
      };

      if (provider.on) {
        provider.on('accountsChanged', handleAccountsChanged);
        provider.on('chainChanged', handleChainChanged);
      }

      // Auto-connect if already trusted
      const manualDisconnect = localStorage.getItem('isManualDisconnect') === 'true';
      if (!isManualDisconnect.current && !manualDisconnect) {
        provider.request({ method: 'eth_accounts' })
          .then(async (accounts) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
              // Note: We DO NOT sync chainId here anymore.
            }
          })
          .catch(console.error)
          .finally(() => setIsInitializing(false));
      } else {
        setIsInitializing(false);
      }

      return () => {
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', handleAccountsChanged);
          provider.removeListener('chainChanged', handleChainChanged);
        }
      };
    } else {
      setIsInitializing(false);
    }
  }, [walletProvider]);

  const onTransactionSuccess = (order) => {
    setRefreshTrigger(order || (prev => (typeof prev === 'number' ? prev + 1 : 1)));
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30">
          {/* ... (导航栏保持不变) ... */}
          <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/5">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center h-auto md:h-20 px-6 py-4 md:py-0 gap-4 md:gap-0">
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                     <img src="./tokens/bfr-logo.svg?v=12" alt="Logo" className="w-full h-full object-cover" />
                   </div>
                   <div>
                     <h1 className="text-xl font-bold text-white tracking-tight">SecureTransfer</h1>
                     <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Decentralized Transfer Protocol</p>
                   </div>
                </div>
                {/* 移动端连接按钮放右上角？或者保持原样在下方 */}
              </div>

     <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                <NetworkSwitcher 
                  provider={walletProvider} 
                  currentChainId={chainId} 
                  onNetworkChange={handleNetworkChange}
                />
                {isInitializing ? (
                  <div className="h-10 w-32 bg-slate-800/50 rounded-full animate-pulse border border-white/5"></div>
                ) : (
                  <ConnectButton 
                    account={account} 
                    onOpenModal={() => setIsWalletModalOpen(true)} 
                    handleDisconnect={handleDisconnect}
                    isConnecting={isConnecting}
                  />
                )}
                {/* 
                  Move WalletModal outside of this flex container or at the end of the return statement
                  to ensure it's not nested inside the navigation header's layout flow, 
                  although fixed positioning usually handles this, it's cleaner.
                  
                  Actually, looking at the code, it is rendered twice!
                  Once inside the nav (line 382) and once at the end of the file (line 451).
                  This causes the double modal issue.
                */}
              </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            <div className="mb-6 px-4 md:px-6 py-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 backdrop-blur-sm">
               <h4 className="text-blue-400 font-bold text-sm mb-1.5 flex items-center gap-2">
                 <FaShieldAlt /> Security Notice
               </h4>
               <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                  <ul className="list-disc pl-4 space-y-1.5 border-t border-blue-500/10 pt-2">
                    <li>
                      <span className="text-slate-300">Verify Before Release:</span> Only click <span className="text-emerald-400 font-medium">Release</span> after the receiver confirms they see the pending transaction in their <strong>Inbox</strong>.
                    </li>
                    <li>
                      <span className="text-slate-300">Wrong Address?</span> If the receiver cannot see the record, you may have entered the wrong address. Please <span className="text-rose-400 font-medium">Cancel</span> immediately to retrieve your funds.
                    </li>
                    <li>
                      <span className="text-slate-300">Don't Wait Too Long:</span> To minimize risk, please complete or cancel transactions promptly. Do not leave funds in the contract for extended periods.
                    </li>
                  </ul>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-4 space-y-8">
                <div className="sticky top-28">
                   <ErrorBoundary>
                      <InitiateTransfer 
                        account={account} 
                        provider={walletProvider}
                        onTransactionSuccess={onTransactionSuccess} 
                        refreshBalanceTrigger={refreshTrigger}
                        activeCount={activeCount}
                        chainId={chainId}
                        activeConfig={activeConfig}
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
                        provider={walletProvider}
                        refreshTrigger={refreshTrigger} 
                        onActionSuccess={() => setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1))}
                        onStatsUpdate={setActiveCount}
                        activeConfig={activeConfig}
                        chainId={chainId}
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
          
          <footer className="max-w-7xl mx-auto px-4 md:px-6 pb-8 text-center">
            <button 
              onClick={() => setIsWhitepaperOpen(true)}
              className="text-xs text-slate-500 hover:text-blue-400 transition-colors border-b border-transparent hover:border-blue-400/50 pb-0.5"
            >
              Read Whitepaper
            </button>
            <p className="text-[10px] text-slate-600 mt-2">
              SecureTransfer Protocol © 2025
            </p>
          </footer>

          <WalletModal 
            isOpen={isWalletModalOpen} 
            onClose={() => setIsWalletModalOpen(false)} 
            onConnect={handleConnect}
          />
          
          <WhitepaperModal 
            isOpen={isWhitepaperOpen} 
            onClose={() => setIsWhitepaperOpen(false)} 
          />
        </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}