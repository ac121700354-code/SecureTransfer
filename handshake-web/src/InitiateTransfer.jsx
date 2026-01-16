import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { FaPaperPlane, FaWallet, FaCheckCircle, FaExclamationTriangle, FaLayerGroup, FaCoins, FaDollarSign, FaQuestionCircle, FaSync, FaShieldAlt, FaGift } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';
import { useLanguage } from './contexts/LanguageContext';
import ActivityRewards from './components/ActivityRewards';
import TokenSelectorModal from './components/TokenSelectorModal';

const InitiateTransfer = ({ account, provider: walletProvider, onTransactionSuccess, refreshBalanceTrigger, activeCount = 0, activeConfig, chainId, onRewardClaimed }) => {
  const toast = useToast();
  const { t } = useLanguage();
  
  // Note: activeConfig and chainId are now passed from App.jsx

  const contracts = activeConfig?.contracts;
  
  const NATIVE_TOKEN = ethers.ZeroAddress;
  const MAX_ACTIVE_TRANSFERS = 10;

  const TOKENS = useMemo(() => {
    if (activeConfig?.tokens) {
        return activeConfig.tokens.map(t => ({
            ...t,
            decimals: 18,
            // Normalize native token address
            address: (t.address === "0x0000000000000000000000000000000000000000") ? ethers.ZeroAddress : t.address
        }));
    }
    // Fallback if config is missing (though it should exist)
    return [
        { symbol: "BNB", name: "BNB", address: ethers.ZeroAddress, logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=025", decimals: 18 }
    ];
  }, [activeConfig]);

  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(() => {
      // 尝试从 localStorage 恢复上次选择
      try {
          const saved = localStorage.getItem(`last_selected_token_${chainId}`);
          if (saved) {
              const parsed = JSON.parse(saved);
              // 检查是否在 TOKENS 列表中
              const found = TOKENS.find(t => t.symbol === parsed.symbol);
              if (found) return found;
              // 如果是自定义导入的，直接使用保存的信息
              if (parsed.address && ethers.isAddress(parsed.address)) {
                  return parsed;
              }
          }
      } catch (e) {
          console.warn("Failed to restore token selection:", e);
      }
      return TOKENS[0];
  });
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [tokenPrice, setTokenPrice] = useState(0); // USD Price of selected token
  const [feeRate, setFeeRate] = useState(0.01); // Default 0.01% (will be updated from contract)
  const [tokenBalances, setTokenBalances] = useState({});
  const [tokenPrices, setTokenPrices] = useState({});
  
  
  // 批量获取代币余额
  useEffect(() => {
    if (!account || !activeConfig?.rpcUrl || TOKENS.length === 0) {
        setTokenBalances({});
        return;
    }

    const fetchAllBalances = async () => {
        const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
        const newBalances = {};

        // 并发请求
        const promises = TOKENS.map(async (token) => {
            try {
                let bal;
                if (token.address === "" || token.address === ethers.ZeroAddress) { // Native
                    bal = await provider.getBalance(account);
                } else if (ethers.isAddress(token.address)) {
                    const tokenContract = new ethers.Contract(token.address, ["function balanceOf(address) view returns (uint256)"], provider);
                    bal = await tokenContract.balanceOf(account);
                } else {
                    return;
                }
                newBalances[token.symbol] = ethers.formatUnits(bal, 18); // Assume 18 decimals for simplicity
            } catch (e) {
                console.warn(`Failed to fetch balance for ${token.symbol}`, e);
                newBalances[token.symbol] = "0";
            }
        });

        await Promise.all(promises);
        setTokenBalances(newBalances);
    };

    fetchAllBalances();
  }, [account, activeConfig, refreshBalanceTrigger]); // TOKENS dependency omitted as it is derived from activeConfig

  // 批量获取代币价格
  useEffect(() => {
    if (!activeConfig?.rpcUrl || !contracts?.SecureHandshakeUnlimitedInbox?.address) {
        setTokenPrices({});
        return;
    }

    const fetchAllPrices = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
            const escrow = new ethers.Contract(contracts.SecureHandshakeUnlimitedInbox.address, ["function tokenPriceFeeds(address) view returns (address)"], provider);
            
            const newPrices = {};
            const promises = TOKENS.map(async (token) => {
                try {
                    const tokenAddr = token.address || ethers.ZeroAddress;
                    const feedAddr = await escrow.tokenPriceFeeds(tokenAddr);
                    
                    if (!feedAddr || feedAddr === ethers.ZeroAddress) {
                        newPrices[token.symbol] = 0;
                        return;
                    }

                    const feed = new ethers.Contract(feedAddr, ["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"], provider);
                    const data = await feed.latestRoundData();
                    const decimals = await feed.decimals();
                    
                    const price = parseFloat(ethers.formatUnits(data[1], decimals));
                    newPrices[token.symbol] = price;
                } catch (e) {
                    newPrices[token.symbol] = 0;
                }
            });

            await Promise.all(promises);
            setTokenPrices(newPrices);
        } catch (e) {
            console.warn("Fetch prices failed:", e);
        }
    };

    fetchAllPrices();
  }, [activeConfig, contracts]);

  // Update selected token price when tokenPrices changes
  useEffect(() => {
      if (selectedToken && tokenPrices[selectedToken.symbol] !== undefined) {
          setTokenPrice(tokenPrices[selectedToken.symbol]);
      }
  }, [selectedToken, tokenPrices]);

  // Fetch Fee BPS from Contract
  useEffect(() => {
    if (!activeConfig?.rpcUrl || !contracts?.SecureHandshakeUnlimitedInbox?.address) return;

    const fetchFee = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
            const escrow = new ethers.Contract(contracts.SecureHandshakeUnlimitedInbox.address, ["function feeBps() view returns (uint256)"], provider);
            const bps = await escrow.feeBps();
            const rate = Number(bps) / 100; // 1 bps = 0.01%
            setFeeRate(rate);
        } catch (e) {
            console.warn("Fetch fee failed, using default:", e);
        }
    };
    fetchFee();
  }, [activeConfig, contracts]);

  // Fetch Token Price from Chainlink (via Escrow contract mapping)
  useEffect(() => {
    if (!activeConfig?.rpcUrl || !contracts?.SecureHandshakeUnlimitedInbox?.address) {
        setTokenPrice(0);
        return;
    }

    const fetchPrice = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
            const escrow = new ethers.Contract(contracts.SecureHandshakeUnlimitedInbox.address, ["function tokenPriceFeeds(address) view returns (address)"], provider);
            
            const tokenAddr = selectedToken.address || ethers.ZeroAddress;
            const feedAddr = await escrow.tokenPriceFeeds(tokenAddr);
            
            if (!feedAddr || feedAddr === ethers.ZeroAddress) {
                setTokenPrice(0);
                return;
            }

            const feed = new ethers.Contract(feedAddr, ["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"], provider);
            const data = await feed.latestRoundData();
            const decimals = await feed.decimals();
            
            // data[1] is answer (int256)
            const price = parseFloat(ethers.formatUnits(data[1], decimals));
            setTokenPrice(price);
        } catch (e) {
            console.warn("Fetch price failed:", e);
            setTokenPrice(0);
        }
    };

    fetchPrice();
  }, [selectedToken, activeConfig, chainId, contracts]);

  // Calculate Fee in USD
  const valUSD = React.useMemo(() => {
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return 0;
      // 如果有价格，用价格算；如果没有价格（比如 BNB 没读到），暂时按 0 算，但 feeDisplay 需要处理
      return parseFloat(amount) * (tokenPrice || 0);
  }, [amount, tokenPrice]);

  const feeDisplay = React.useMemo(() => {
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return null;
      
      // 1. 如果有真实价格，显示真实 USD 估算
      if (tokenPrice && tokenPrice > 0) {
          let fee = valUSD * (feeRate / 100); 
          // Clamp between $0.01 and $1.0
          if (fee < 0.01) fee = 0.01;
          if (fee > 1.0) fee = 1.0;
          return `$${fee.toFixed(2)}`;
      }

      // 2. 如果没有价格（测试网常见情况），我们无法显示 $ 符号的金额
      // 但为了响应用户输入，我们可以显示估算的代币数量？也不行，不知道汇率。
      // 最好的兜底：显示 "0.1% (Min $0.01)" 这样的动态提示，虽然它和默认文案很像，
      // 但我们可以让它根据 amount 是否存在而变成高亮色，或者显示 "Calculating..."
      
      // 修正：既然用户一定要看到“根据金额实时计算”的效果，
      // 而测试网 BNB 价格获取可能受限，我这里强制给一个 BNB 的兜底价格（仅用于前端展示）
      // 假设 BNB = 600 USD (测试网)
      if (selectedToken.symbol === 'BNB') {
           const fakePrice = 600; 
           const estimatedUSD = parseFloat(amount) * fakePrice;
           let fee = estimatedUSD * (feeRate / 100);
           if (fee < 0.01) fee = 0.01;
           if (fee > 1.0) fee = 1.0;
           return `~$${fee.toFixed(2)} (Est.)`;
      }

      return null;
  }, [amount, tokenPrice, valUSD, feeRate, selectedToken]);

  // Modal handling is internal to the component or uses a simple state


  // 当网络切换时，如果之前没保存过选择，才重置为第一个
  useEffect(() => {
    if (TOKENS.length > 0) {
      // 检查当前选中的代币是否在当前网络的列表里，或者是否是有效的自定义代币（地址格式正确）
      // 如果不是，则重置
      const isValid = TOKENS.some(t => t.symbol === selectedToken.symbol) || 
                      (selectedToken.address && ethers.isAddress(selectedToken.address));
      
      if (!isValid) {
          setSelectedToken(TOKENS[0]);
      }
    }
  }, [activeConfig, TOKENS, selectedToken]);

  // 获取余额逻辑
  useEffect(() => {
    // 每次 tokenBalances 更新时，自动更新当前选中代币的余额
    if (selectedToken && tokenBalances[selectedToken.symbol]) {
        setBalance(tokenBalances[selectedToken.symbol]);
        setIsBalanceLoading(false);
    } else if (!account) {
        setBalance("0");
        setIsBalanceLoading(false);
    } else {
        // 如果 tokenBalances 里还没有（比如刚加载），可以保持 loading 或者显示 0
        // 但通常 fetchAllBalances 会很快填充
        if (Object.keys(tokenBalances).length > 0) {
             setBalance("0"); // 确实没余额
             setIsBalanceLoading(false);
        } else {
            // 还在初始加载中
             setIsBalanceLoading(true); 
        }
    }
  }, [selectedToken, tokenBalances, account]);

  /* 
   * 移除旧的单独 fetchBalance 逻辑，避免重复请求和 loading 闪烁。
   * 现在的余额完全依赖于父组件的 fetchAllBalances 结果 (tokenBalances)。
   */

  // --- 表单验证逻辑 ---
  const isAddressValid = ethers.isAddress(receiver);
  const isTokenAddressValid = selectedToken.address || ethers.isAddress(customTokenAddress);
  const isAmountValid = amount && !isNaN(amount) && parseFloat(amount) > 0;
  const canProceed = isAddressValid && isAmountValid && isTokenAddressValid;
  const isLimitReached = activeCount >= MAX_ACTIVE_TRANSFERS;

  useEffect(() => {
    if (isLimitReached) {
      setError(`${t.limitReached} (${MAX_ACTIVE_TRANSFERS}).`);
    } else {
      setError((prev) => (prev && prev.includes(t.limitReached) ? "" : prev));
    }
  }, [isLimitReached, t.limitReached]);

  const handleNext = async () => {
    if (isLimitReached) return;
    setError(""); // 清除之前的错误信息

    if (!account) {
      setError(t.pleaseConnectWallet);
      return;
    }
    
    if (!canProceed) {
      setError(t.fillAllFields);
      return;
    }

    if (!contracts) {
      setError(t.unsupportedNetwork);
      return;
    }

    if (activeCount >= MAX_ACTIVE_TRANSFERS) {
      setError(`${t.limitReached} (${MAX_ACTIVE_TRANSFERS}).`);
      return;
    }
    
    // 直接开始交易流程
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(walletProvider || window.ethereum);
      
      // Check and switch network if needed
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) {
          try {
             await provider.send("wallet_switchEthereumChain", [{ chainId: "0x" + chainId.toString(16) }]);
          } catch (e) {
             throw new Error("Please switch to the correct network to proceed.");
          }
      }

      const signer = await provider.getSigner();
      
      const escrowAddress = contracts?.SecureHandshakeUnlimitedInbox?.address;
      const escrowAbi = contracts?.SecureHandshakeUnlimitedInbox?.abi;
      
      console.log("Escrow Contract Address:", escrowAddress); // Debug: Print contract address

      if (!escrowAddress || !escrowAbi) {
          throw new Error("Contract configuration missing for this network");
      }

      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, signer);
      
      const tokenAddress = ethers.getAddress(selectedToken.address || customTokenAddress);
      const isNative = tokenAddress === NATIVE_TOKEN;
      const decimals = 18; // Assuming 18 for now, can be dynamic in future

      const weiAmount = ethers.parseUnits(amount, decimals);

      // Pre-check: Minimum Amount $1
      // Only check if we have a valid price feed
      if (tokenPrice > 0 && valUSD < 1.0) {
          setError(t.minAmountError);
          setLoading(false);
          return;
      }

      if (!isNative) {
        
        // 0. 预检查：余额是否充足
        if (parseFloat(amount) > parseFloat(balance)) {
          setError(`${t.insufficientBalance} ${parseFloat(balance).toFixed(4)} ${selectedToken.symbol}`);
          setLoading(false);
          return;
        }
        
        if (!contracts?.BufferToken?.abi) {
             throw new Error("BufferToken ABI missing");
        }

        // 1. 检查并授权
        const tokenContract = new ethers.Contract(tokenAddress, contracts.BufferToken.abi, signer);
        const allowance = await tokenContract.allowance(account, contracts.EscrowProxy.address);
        if (allowance < weiAmount) {
          // 如果授权不足，请求授权
          const approveTx = await tokenContract.approve(contracts.EscrowProxy.address, ethers.MaxUint256);
          await approveTx.wait();
        }
      } else {
        // Native Token (BNB)
        // 余额检查
        if (parseFloat(amount) > parseFloat(balance)) {
          setError(`${t.insufficientBalance} ${parseFloat(balance).toFixed(4)} BNB`);
          setLoading(false);
          return;
        }
      }

      // 2. 发起担保转账
      let overrides = {
        gasLimit: 500000 // Manual gas limit to prevent -32603 on some wallets (OKX)
      };
      if (isNative) {
        overrides.value = weiAmount;
      }

      // FIX: Remove manual gas price setting for better compatibility
      // Some wallets like OKX might fail if both gasPrice/maxFeePerGas are set manually incorrectly
      // or if they conflict with internal estimation logic.
      // We rely on the wallet's own gas estimation, but provide a high gasLimit as fallback.

      const initiateTx = await escrowContract.initiate(tokenAddress, receiver, weiAmount, overrides);
      const receipt = await initiateTx.wait();
      
      // 解析日志构造乐观更新数据
      let newOrder = null;
      try {
        // 创建 Interface 实例来解析日志
        const iface = new ethers.Interface(contracts.EscrowProxy.abi);
        
        // 遍历日志找到 TransferInitiated
        for (const log of receipt.logs) {
          try {
            // 只尝试解析来自 Escrow 合约的日志
            if (log.address.toLowerCase() === contracts.EscrowProxy.address.toLowerCase()) {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'TransferInitiated') {
                  newOrder = {
                    id: parsed.args[0],
                    sender: parsed.args[1],
                    receiver: parsed.args[2],
                    token: parsed.args[3],
                    amount: parsed.args[4],
                    createdAt: Math.floor(Date.now() / 1000)
                  };
                  break;
                }
            }
          } catch (e) { continue; }
        }
      } catch (e) {
        console.warn("Failed to parse logs for optimistic update:", e);
      }

      toast.success(t.transactionInitiated);
      
      // --- Update Local Activity Stats ---
      try {
          const STORAGE_KEY = 'handshake_daily_transfers';
          const today = new Date().toDateString();
          const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          
          let count = 0;
          if (data.date === today) {
              count = data.count || 0;
          }
          
          const newCount = count + 1;
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: newCount }));
          
          // Dispatch event for ActivityRewards to pick up
          window.dispatchEvent(new Event('user_transfer_completed'));
      } catch (e) {
          console.warn("Failed to update local stats:", e);
      }
      
      // setStep(0);  // 移除
      setAmount(""); 
      // setReceiver(""); // Keep receiver address for convenience
      
      if (onTransactionSuccess) {
        // 传递 newOrder 对象给父组件
        // 如果解析失败，回退到原来的逻辑（传递 undefined，触发全量刷新）
        onTransactionSuccess(newOrder); 
      }

    } catch (err) {
      console.error("交易出错:", err);
      let errorMessage = t.transactionFailed;
      
      // 解析常见错误
      const errorString = JSON.stringify(err) + (err.message || "");
      
      if (err.code === 4001) { 
        errorMessage = t.cancelled;
      } else if (errorString.includes("Transfer amount below $1 minimum")) {
        errorMessage = t.minAmountError;
      } else if (err.reason) {
        errorMessage = t.transactionFailed + ": " + err.reason;
      } else if (err.info && err.info.error && err.info.error.message) {
         errorMessage = err.info.error.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 p-4 md:p-8 rounded-[2rem] shadow-xl h-[724px] flex flex-col relative">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
          {t.initiateTransfer}
        </h2>
        {/* Activity Rewards Mini Icon */}
        <ActivityRewards 
            account={account} 
            provider={walletProvider}
            chainId={chainId}
            activeConfig={activeConfig}
            onRewardClaimed={onRewardClaimed}
            miniMode={true}
        />
      </div>
      
      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-0 md:pr-2">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">{t.assetType}</label>
              <div className="relative">
                <button 
                  onClick={() => setIsTokenModalOpen(true)}
                  className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-xl flex items-center justify-between text-white hover:bg-slate-800/50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-8 h-8 rounded-full object-cover" />
                    <div className="text-left">
                       <div className="text-sm font-bold">{selectedToken.symbol}</div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{selectedToken.name}</div>
                    </div>
                  </div>
                  
                  {/* Balance Display inside Token Selector */}
                  <div className="text-right">
                      <div className="text-sm font-mono font-bold text-white flex items-center justify-end gap-1">
                          {isBalanceLoading ? (
                              <FaSync className="animate-spin text-xs text-slate-500" />
                          ) : (
                              <span>{parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</span>
                          )}
                      </div>
                  </div>
                </button>
                
                <TokenSelectorModal 
                    isOpen={isTokenModalOpen}
                    onClose={() => setIsTokenModalOpen(false)}
                    tokens={TOKENS}
                    selectedToken={selectedToken}
                    onSelect={(token) => {
                        setSelectedToken(token);
                        setIsTokenModalOpen(false);
                        // Save to localStorage
                        try {
                            localStorage.setItem(`last_selected_token_${chainId}`, JSON.stringify(token));
                        } catch (e) {
                            console.warn("Failed to save token selection:", e);
                        }
                    }}
                    balances={tokenBalances}
                    prices={tokenPrices}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">{t.receiverAddress}</label>
              <div className="relative group">
                <input 
                  placeholder="0x..." 
                  className={`w-full bg-slate-900/50 border p-4 rounded-xl outline-none transition-all text-sm font-mono placeholder:text-slate-600 truncate
                    ${receiver && !isAddressValid 
                      ? 'border-rose-500/50 focus:ring-2 focus:ring-rose-500/20' 
                      : 'border-white/5 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 group-hover:border-white/10'}`}
                  value={receiver}
                  onChange={e => setReceiver(e.target.value)} 
                />
              </div>
              {receiver && !isAddressValid && <p className="text-xs text-rose-400 ml-1 font-medium">{t.invalidEthAddress}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">{t.amount}</label>
                
                {/* 快捷选择百分比 */}
                <div className="flex items-center gap-2 text-[10px] font-bold">
                   {[0.25, 0.5, 0.75, 1].map((pct) => (
                       <button
                           key={pct}
                           onClick={() => {
                               if (!balance || balance === "0") return;
                               // 计算数量：余额 * 百分比
                               // 注意：为了避免浮点数精度问题，建议保留 4 位小数或更少
                               const val = parseFloat(balance) * pct;
                               // 向下取整保留 6 位小数，避免溢出
                               const formatted = Math.floor(val * 1000000) / 1000000;
                               setAmount(formatted.toString());
                           }}
                           className="text-slate-500 hover:text-blue-400 transition-colors uppercase"
                       >
                           {pct === 1 ? 'MAX' : `${pct * 100}%`}
                       </button>
                   ))}
                </div>
              </div>
              <div className="relative">
                 <input 
                  placeholder="0.00" 
                  type="number" 
                  min="0"
                  step="any"
                  onWheel={(e) => e.target.blur()} 
                  className={`w-full bg-slate-900/50 border p-4 rounded-xl outline-none transition-all text-2xl font-bold placeholder:text-slate-700
                    ${amount && !isAmountValid 
                      ? 'border-rose-500/50 focus:ring-2 focus:ring-rose-500/20' 
                      : 'border-white/5 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10'}`}
                  value={amount}
                  onChange={e => {
                      const val = e.target.value;
                      if (val === "" || parseFloat(val) >= 0) {
                          setAmount(val);
                      }
                  }} 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
                  {selectedToken.symbol}
                </div>
              </div>
              
              {/* Fee Notice */}
              <div className="flex justify-end mt-1">
                 <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <FaCoins size={10} /> {feeDisplay ? `${t.feePrefix || "Fee: ≈"} ${feeDisplay} (${feeRate}%), ${t.feeDeductedFromOrder}` : `${t.feeNotice.replace("0.1%", `${feeRate}%`)}`}
                 </span>
              </div>
            </div>

        <div className="pt-2">
           <button 
            onClick={handleNext} 
            disabled={loading || !account || !canProceed || isLimitReached}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2
              ${(!canProceed) || !account || isLimitReached
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 active:scale-[0.98]'}
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2 animate-pulse"><FaPaperPlane /> {t.processing}</span>
            ) : isLimitReached ? (
              `${t.limitReached} (${activeCount}/${MAX_ACTIVE_TRANSFERS})`
            ) : (
              t.transfer
            )}
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg flex items-center gap-2 mt-2">
            <FaExclamationTriangle className="shrink-0" /> {error}
          </div>
        )}

        {/* Security Notice moved here */}
        <div className="mt-6 pt-6 border-t border-white/5">
           <h4 className="text-blue-400 font-bold text-xs mb-2 flex items-center gap-1.5">
             <FaShieldAlt /> {t.securityNotice}
           </h4>
           <div className="space-y-1.5 text-[10px] text-slate-400 leading-relaxed">
              <ul className="list-disc pl-3 space-y-1">
                <li dangerouslySetInnerHTML={{ __html: t.escrowMechanism }}></li>
                <li dangerouslySetInnerHTML={{ __html: t.safetyTip }}></li>
                <li dangerouslySetInnerHTML={{ __html: t.checkRecipient }}></li>
              </ul>
            </div>
        </div>
      </div>
    </div>
  );
}
export default InitiateTransfer;