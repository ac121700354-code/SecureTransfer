import React, { useEffect, useState } from 'react';
import { FaTimes, FaChevronRight } from 'react-icons/fa';

// Hook to discover EIP-6963 providers
const useEIP6963 = () => {
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    const onAnnounce = (event) => {
      setProviders(prev => {
        // Avoid duplicates
        if (prev.some(p => p.info.uuid === event.detail.info.uuid)) return prev;
        return [...prev, event.detail];
      });
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  return providers;
};

const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    getProvider: (eip6963Providers) => {
        // 1. First try EIP-6963 providers (Most reliable)
        if (eip6963Providers?.length) {
            const detail = eip6963Providers.find(p => p.info.name === 'MetaMask' || p.info.rdns === 'io.metamask');
            if (detail) return detail.provider;
        }

        // 2. Check window.ethereum.providers (Legacy multi-injection)
        if (window.ethereum?.providers?.length) {
            const provider = window.ethereum.providers.find(p => p.isMetaMask && !p.isOkxWallet);
            if (provider) return provider;
        }

        // 3. Check global window.ethereum (Legacy single-injection)
        // Ensure it's not OKX hijacking MetaMask identity
        if (window.ethereum?.isMetaMask && !window.ethereum.isOkxWallet) {
             return window.ethereum;
        }
        
        // Fallback: If it's the only provider, assume it's safe-ish, but check exclusions
        if (window.ethereum && !window.ethereum.isBitKeep && !window.ethereum.isOkxWallet) return window.ethereum;
        
        return undefined;
    },
    download: 'https://metamask.io/download/',
    deepLink: 'https://metamask.app.link/dapp/ac121700354-code.github.io/SecureTransfer/' 
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: 'https://avatars.githubusercontent.com/u/43102456?s=200&v=4',
    getProvider: () => window.okxwallet || (window.ethereum?.isOkxWallet ? window.ethereum : undefined),
    download: 'https://www.okx.com/web3',
    deepLink: 'okx://wallet/dapp/details?dappUrl=https://ac121700354-code.github.io/SecureTransfer/'
  },
  {
    id: 'binance',
    name: 'Binance Wallet',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    getProvider: () => window.BinanceChain,
    download: 'https://www.bnbchain.org/en/binance-wallet',
    deepLink: 'bnc://app.binance.com/mp/aggr/page/ikmp/index?path=pages/home/index&dappUrl=https://ac121700354-code.github.io/SecureTransfer/' // 通用唤起，或使用 Trust Wallet 的 trust://
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    icon: 'https://avatars.githubusercontent.com/u/39734533?s=200&v=4',
    getProvider: () => window.bitkeep?.ethereum || (window.isBitKeep ? window.ethereum : undefined),
    download: 'https://web3.bitget.com/en/wallet-download',
    deepLink: 'https://bkcode.vip?action=dapp&url=https://ac121700354-code.github.io/SecureTransfer/'
  }
];

const WalletModal = ({ isOpen, onClose, onConnect }) => {
  const eip6963Providers = useEIP6963();

  // 简单的移动端检测
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (!isOpen) return null;

  const handleWalletClick = (wallet) => {
    const provider = wallet.getProvider(eip6963Providers);
    
    if (provider) {
      // 1. 已安装（无论是 PC 插件还是 App 内置浏览器环境）
      onConnect(provider, wallet.name);
      onClose();
    } else if (isMobile && wallet.deepLink) {
      // 2. 移动端未检测到 Provider，尝试唤起 App
      // 注意：DeepLink 需要部署后的公网域名才能正常工作，这里用 window.location.host 动态替换
      let url = wallet.deepLink;
      
      // 动态替换 DeepLink 中的目标 URL 为当前页面 URL
      const currentUrl = encodeURIComponent(window.location.href);
      if (wallet.id === 'metamask') {
         url = `https://metamask.app.link/dapp/${window.location.host}`;
      } else if (wallet.id === 'okx') {
         url = `okx://wallet/dapp/details?dappUrl=${currentUrl}`;
      } else if (wallet.id === 'bitget') {
         url = `https://bkcode.vip?action=dapp&url=${currentUrl}`;
      }

      window.location.href = url;
    } else {
      // 3. PC 端未安装，去下载页
      window.open(wallet.download, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* List */}
        <div className="p-4 space-y-2">
          {WALLETS.map((wallet) => {
            const isInstalled = !!wallet.getProvider(eip6963Providers);
            return (
              <button
                key={wallet.id}
                onClick={() => handleWalletClick(wallet)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-blue-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 p-1.5 flex items-center justify-center">
                    <img src={wallet.icon} alt={wallet.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                      {wallet.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isInstalled ? 'Detected' : 'Not Installed'}
                    </div>
                  </div>
                </div>
                {isInstalled ? (
                  <FaChevronRight className="text-slate-600 group-hover:text-blue-500 transition-colors text-xs" />
                ) : (
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">INSTALL</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 border-t border-white/5 text-center">
          <p className="text-xs text-slate-500">
            New to Ethereum? <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Learn more about wallets</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
