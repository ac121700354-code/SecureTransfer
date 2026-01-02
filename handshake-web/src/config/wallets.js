export const WALLETS = [
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
    deepLink: 'bnc://app.binance.com/defi/wallet-connect?uri=https://ac121700354-code.github.io/SecureTransfer/' 
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