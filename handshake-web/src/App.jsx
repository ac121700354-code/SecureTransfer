import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { ethers } from 'ethers';
import InitiateTransfer from './InitiateTransfer';
import OrderList from './OrderList';
import TransactionHistory from './components/TransactionHistory';
import IntroSection from './components/IntroSection';
import { FaWallet, FaShieldAlt, FaSignOutAlt, FaExchangeAlt, FaNetworkWired, FaEthereum, FaLayerGroup, FaChevronDown, FaSpinner, FaGlobe, FaBook, FaRegCopy, FaTwitter } from 'react-icons/fa';
import { SiBinance, SiX } from 'react-icons/si';
import WalletModal from './components/WalletModal';
import { ToastProvider, useToast } from './components/Toast';
import WhitepaperModal from './components/WhitepaperModal';
import config from './config.json';
import { translations } from './translations';
import { WALLETS } from './config/wallets';

// --- Language Context ---
export const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

// --- Language Switcher Component ---
const LanguageSwitcher = () => {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const LANGUAGES = {
    en: { name: 'English', flag: '🇺🇸' },
    zh: { name: '简体中文', flag: '🇨🇳' }
  };

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

  return (
    <div className="relative language-switcher" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-all"
        title="Switch Language"
      >
        <span className="text-sm">{LANGUAGES[lang].flag}</span>
        <FaChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
           <div className="py-1">
             {Object.keys(LANGUAGES).map((code) => {
                const isActive = code === lang;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      setLang(code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${isActive ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-white/5'}
                    `}
                  >
                    <span className="text-lg">{LANGUAGES[code].flag}</span>
                    <span className="font-medium">{LANGUAGES[code].name}</span>
                  </button>
                );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

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
  const { t } = useLanguage();
  
  if (isConnecting) {
    return (
      <button 
        disabled
        className="px-6 py-2.5 bg-blue-600/50 text-white/80 rounded-full transition-all font-semibold text-sm flex items-center gap-2 cursor-wait"
      >
        <FaSpinner className="animate-spin" /> {t.processing}
      </button>
    );
  }
  
  if (account) {
    const handleCopy = () => {
      navigator.clipboard.writeText(account);
      toast.success(t.copied || "Copied!");
    };

    return (
      <div className="flex items-center bg-slate-800/50 border border-white/5 rounded-full p-1 pl-3 pr-1 shadow-sm transition-all hover:bg-slate-800">
        <div 
            className="flex flex-col items-end mr-2 leading-tight cursor-pointer group"
            onClick={handleCopy}
            title="Click to copy address"
        >
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
             {t.detected} <FaRegCopy className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" size={10} />
           </span>
           <span className="text-sm font-mono text-blue-400 font-semibold">{account.slice(0, 6)}...{account.slice(-4)}</span>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={handleDisconnect} 
            title={t.disconnect}
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
      <FaWallet /> {t.connectWallet}
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
  
  // Initialize language from localStorage or default to 'en'
  const [lang, setLang] = useState(() => {
      return localStorage.getItem('appLanguage') || 'en';
  });
  
  // Persist language change to localStorage
  useEffect(() => {
      localStorage.setItem('appLanguage', lang);
  }, [lang]);

  const t = translations[lang];

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'zh' : 'en');
  };
  
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

  // Global Auto-Refresh Timer (60s)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if user is connected
      if (account) {
        setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [account]);

  const handleConnect = useCallback(async (providerObj, walletName) => {
    localStorage.removeItem('isManualDisconnect');
    isManualDisconnect.current = false;

    // Save wallet choice for auto-connect
    try {
        const walletConfig = WALLETS.find(w => w.name === walletName);
        if (walletConfig) {
            localStorage.setItem('lastWalletId', walletConfig.id);
        }
    } catch (e) {
        console.error("Failed to save wallet preference:", e);
    }

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
    // Separate listener effect to avoid re-binding during auto-connect logic
    if (!walletProvider) return;
    
    const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
            setAccount(accounts[0]);
            setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1));
        } else {
            setAccount("");
        }
    };

    const handleChainChanged = (chainIdHex) => {
        const id = parseInt(chainIdHex, 16);
        console.log("Wallet Chain Changed (Ignored by UI):", id);
        setRefreshTrigger(prev => (typeof prev === 'number' ? prev + 1 : 1));
    };

    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }

    return () => {
        if (walletProvider.removeListener) {
            walletProvider.removeListener('accountsChanged', handleAccountsChanged);
            walletProvider.removeListener('chainChanged', handleChainChanged);
        }
    };
  }, [walletProvider]);

  useEffect(() => {
    // Flag to synchronize between EIP-6963 and initAuth fallback
    let isAuthCompleted = false;

    const initAuth = async () => {
      // If already connected via EIP-6963, skip this fallback
      if (isAuthCompleted) return;

      try {
        // 1. Check if manually disconnected
        const manualDisconnect = localStorage.getItem('isManualDisconnect') === 'true';
        const lastWalletId = localStorage.getItem('lastWalletId');
        
        if (isManualDisconnect.current || manualDisconnect) {
            return;
        }

        // Wait a bit longer to give EIP-6963 a chance to win first
        await new Promise(r => setTimeout(r, 1500));
        
        // Double check after wait
        if (isAuthCompleted) return;

        // 2. Try to get provider with retries (wait for injection)
        let provider = walletProvider || window.ethereum;
        let retries = 0;
        // Wait up to 1 second for injection
        while (!provider && retries < 10) {
            await new Promise(r => setTimeout(r, 100));
            provider = window.ethereum;
            retries++;
        }

        // 3. Try to recover specific provider from lastWalletId
        let recoveredProvider = null;
        try {
            if (lastWalletId && typeof WALLETS !== 'undefined') {
                 const walletConfig = WALLETS.find(w => w.id === lastWalletId);
                 if (walletConfig) {
                     // IMPORTANT: Pass window.ethereum?.providers as well to help getProvider find the right one
                     // Some wallets inject into window.ethereum.providers but might not be the active window.ethereum
                     const specificProvider = walletConfig.getProvider([]); 
                     if (specificProvider) {
                         recoveredProvider = specificProvider;
                     }
                 }
            }
        } catch (err) {
            console.warn("Failed to recover wallet provider:", err);
        }

        // Only use recovered provider if we actually found one.
        // If recoveredProvider is null, it means we couldn't find the specific wallet user used last time.
        // In that case, we should NOT fallback to 'provider' (window.ethereum) blindly if it might be the wrong one.
        // BUT, if we don't fallback, user has to connect again.
        // The issue "linking to another wallet" happens because window.ethereum defaults to the last injected one (e.g. OKX),
        // while user wants MetaMask.
        
        let activeProvider = recoveredProvider;
        
        // Strategy:
        // 1. If we found a specific recoveredProvider, use it.
        // 2. If not, but we have a lastWalletId, try the default provider (window.ethereum) cautiously.
        //    - If it already has authorized accounts (eth_accounts returns > 0), we connect. 
        //      (This handles the case where MetaMask is hidden by OKX but user authorized OKX before, 
        //       or MetaMask is just slow to inject but window.ethereum works).
        //    - If it has NO accounts, we DO NOT connect to avoid connecting to the wrong wallet unexpectedly.

        if (!activeProvider && localStorage.getItem('lastWalletId')) {
              // Fallback to default provider to check for existing authorization
              activeProvider = provider;
        } else if (!activeProvider && !localStorage.getItem('lastWalletId')) {
              // No preference, no auto-connect
              activeProvider = null;
        }

        if (activeProvider) {
            // Update state if we found a better provider
            if (activeProvider !== walletProvider) {
                setWalletProvider(activeProvider);
            }

            // 4. Request accounts (silently)
            try {
                const accounts = await activeProvider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                }
            } catch (e) {
                console.warn("Auto-connect failed:", e);
            }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    // EIP-6963 Listener for auto-connect
    const handleEIP6963 = (event) => {
        const manualDisconnect = localStorage.getItem('isManualDisconnect') === 'true';
        const lastWalletId = localStorage.getItem('lastWalletId');
        
        if (manualDisconnect) return;
        if (!lastWalletId) return; 

        const detail = event.detail;
        if (!detail) return;

        let match = false;
        if (lastWalletId === 'metamask' && (detail.info.name === 'MetaMask' || detail.info.rdns === 'io.metamask')) match = true;
        else if (lastWalletId === 'okx' && (detail.info.name === 'OKX Wallet' || detail.info.rdns === 'com.okex.wallet')) match = true;
        else if (lastWalletId === 'binance' && (detail.info.name === 'Binance Web3 Wallet' || detail.info.rdns === 'com.binance.w3w')) match = true;
        else if (lastWalletId === 'bitget' && (detail.info.name === 'Bitget Wallet' || detail.info.rdns === 'com.bitget.web3')) match = true;
        
        if (match) {
            isAuthCompleted = true;
            const provider = detail.provider;
            // Only switch if different (though provider objects identity might vary)
            setWalletProvider(provider);
            provider.request({ method: 'eth_accounts' })
                .then(accounts => {
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);
                        // Stop initializing if we found it late
                        setIsInitializing(false);
                    }
                })
                .catch(console.error);
        }
    };

    window.addEventListener("eip6963:announceProvider", handleEIP6963);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    initAuth();

    return () => {
        window.removeEventListener("eip6963:announceProvider", handleEIP6963);
    };
  }, []); // Run once on mount

  const onTransactionSuccess = (order) => {
    setRefreshTrigger(order || (prev => (typeof prev === 'number' ? prev + 1 : 1)));
  };

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
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
                       <h1 className="text-xl font-bold text-white tracking-tight">{t.appTitle}</h1>
                       <button 
                         onClick={() => setIsWhitepaperOpen(true)}
                         className="group flex items-center gap-1.5 text-[10px] text-slate-400 font-medium tracking-wide uppercase hover:text-blue-400 transition-colors py-0.5 text-left"
                         title={t.whitepaper}
                       >
                         <span className="border-b border-slate-700 group-hover:border-blue-400/50 transition-colors pb-px">{t.appSubtitle}</span>
                       </button>
                     </div>
                  </div>
                  {/* 移动端连接按钮放右上角？或者保持原样在下方 */}
                </div>

       <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                  <LanguageSwitcher />

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
              <IntroSection />
              
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
                    <div className="min-h-[700px] h-full flex flex-col items-center justify-center bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-700/50">
                      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <FaWallet className="text-3xl text-slate-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-300 mb-2">{t.pleaseConnectWallet}</h3>
                      <p className="text-slate-500 text-sm max-w-xs text-center">{t.connectToView}</p>
                    </div>
                  )}
                </div>
              
              {account && (
                <div className="lg:col-span-12">
                   <ErrorBoundary>
                      <TransactionHistory 
                          account={account} 
                          provider={walletProvider}
                          chainId={chainId}
                          activeConfig={activeConfig}
                          refreshTrigger={refreshTrigger}
                      />
                   </ErrorBoundary>
                </div>
              )}
            </div>
          </main>
            
            <footer className="max-w-7xl mx-auto px-4 md:px-6 pb-8 text-center">
              <div className="flex justify-center items-center gap-4 mb-2">
                <a href="https://x.com/fdlshit" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                  <SiX size={16} />
                </a>
              </div>
              <p className="text-[10px] text-slate-600">
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
    </LanguageContext.Provider>
  );
}