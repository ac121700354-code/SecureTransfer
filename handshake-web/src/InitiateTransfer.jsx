import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { FaPaperPlane, FaWallet, FaCheckCircle, FaExclamationTriangle, FaChevronDown, FaLayerGroup, FaCoins, FaDollarSign, FaQuestionCircle, FaSync, FaShieldAlt } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';
import { useLanguage } from './App';

const InitiateTransfer = ({ account, provider: walletProvider, onTransactionSuccess, refreshBalanceTrigger, activeCount = 0, activeConfig, chainId }) => {
  const toast = useToast();
  const { t } = useLanguage();
  
  // Note: activeConfig and chainId are now passed from App.jsx

  const contracts = activeConfig?.contracts;
  
  const NATIVE_TOKEN = ethers.ZeroAddress;
  const MAX_ACTIVE_TRANSFERS = 10;

  const tokensConfig = activeConfig?.tokens || [];
  
  const TOKENS = tokensConfig.map(t => {
      return { 
          symbol: t.symbol, 
          name: t.name, 
          address: t.address || "", 
          logo: t.logo 
      };
  });

  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  
  const tokenDropdownRef = useRef(null);

  // 点击外部关闭代币下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target)) {
        setIsTokenOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 当网络切换时，重置选中的代币为列表第一个
  useEffect(() => {
    if (TOKENS.length > 0) {
      setSelectedToken(TOKENS[0]);
    }
  }, [activeConfig]);

  // 获取余额逻辑
  useEffect(() => {
    if (!account || !contracts) {
        setBalance("0");
        return;
    }

    const fetchBalance = async () => {
        setIsBalanceLoading(true);
        try {
            if (!activeConfig?.rpcUrl) return;
            // Use RPC Provider for viewing balance regardless of wallet state
            const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
            let bal;
            const tokenAddress = selectedToken.address || customTokenAddress;
            
            if (!tokenAddress) {
                setIsBalanceLoading(false);
                return;
            }

            if (tokenAddress === NATIVE_TOKEN) {
                bal = await provider.getBalance(account);
            } else if (ethers.isAddress(tokenAddress)) {
                // 假设 ERC20 标准
                const tokenContract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], provider);
                bal = await tokenContract.balanceOf(account);
            } else {
                setIsBalanceLoading(false);
                return;
            }
            
            // 简单处理：默认 18 位精度。
            setBalance(ethers.formatUnits(bal, 18));
        } catch (e) {
            console.error("Fetch balance failed:", e);
            setBalance("0");
        } finally {
            setIsBalanceLoading(false);
        }
    };

    fetchBalance();
  }, [account, selectedToken, customTokenAddress, refreshBalanceTrigger, contracts]);

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
      
      const escrowAddress = contracts?.EscrowProxy?.address;
      const escrowAbi = contracts?.EscrowProxy?.abi;
      
      if (!escrowAddress || !escrowAbi) {
          throw new Error("Contract configuration missing for this network");
      }

      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, signer);
      
      const tokenAddress = ethers.getAddress(selectedToken.address || customTokenAddress);
      const isNative = tokenAddress === NATIVE_TOKEN;
      const decimals = 18; // Assuming 18 for now, can be dynamic in future

      const weiAmount = ethers.parseUnits(amount, decimals);

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
      let overrides = {};
      if (isNative) {
        overrides.value = weiAmount;
      }

      // FIX: OKX Wallet "Unknown Transaction Type" & "0 Gas" issue
      // We explicitly fetch and set fee data (Gas Price) to ensure the wallet recognizes the fee.
      try {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
           // EIP-1559 (Preferred for BNB Chain)
           overrides.maxFeePerGas = feeData.maxFeePerGas;
           overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        } else if (feeData.gasPrice) {
           // Legacy fallback
           overrides.gasPrice = feeData.gasPrice;
        }
      } catch (feeError) {
        console.warn("Failed to fetch fee data:", feeError);
      }

      // FIX: OKX Wallet often fails to estimate gas correctly or sets it too low.

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
      const errorString = JSON.stringify(err);
      
      if (err.code === 4001) { 
        errorMessage = t.cancelled;
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
    <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 p-4 md:p-8 rounded-[2rem] shadow-xl h-auto flex flex-col">
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 shrink-0">
        <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
        {t.initiateTransfer}
      </h2>
      
      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-0 md:pr-2">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">{t.assetType}</label>
              <div className="relative" ref={tokenDropdownRef}>
                <button 
                  onClick={() => setIsTokenOpen(!isTokenOpen)}
                  className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-xl flex items-center justify-between text-white hover:bg-slate-800/50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-8 h-8 rounded-full" />
                    <div className="text-left">
                       <div className="text-sm font-bold">{selectedToken.symbol}</div>
                       <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{selectedToken.name}</div>
                    </div>
                  </div>
                  <FaChevronDown className={`text-slate-500 transition-transform ${isTokenOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isTokenOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/5 rounded-xl overflow-hidden shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                    {TOKENS.map(t => (
                       <button 
                         key={t.symbol}
                         onClick={() => { setSelectedToken(t); setIsTokenOpen(false); setCustomTokenAddress(""); }}
                         className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                       >
                         <img src={t.logo} alt={t.symbol} className="w-6 h-6 rounded-full" />
                         <div className="flex-1">
                            <div className={`text-sm font-bold ${selectedToken.symbol === t.symbol ? 'text-white' : 'text-slate-300'}`}>{t.symbol}</div>
                            <div className="text-[10px] text-slate-500">{t.name}</div>
                         </div>
                         {selectedToken.symbol === t.symbol && <FaCheckCircle className="text-blue-500" />}
                       </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!selectedToken.address && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">{t.tokenContractAddress}</label>
                <div className="relative group">
                  <input 
                    placeholder="0x..." 
                    className={`w-full bg-slate-900/50 border p-4 rounded-xl outline-none transition-all text-sm font-mono placeholder:text-slate-600
                      ${customTokenAddress && !ethers.isAddress(customTokenAddress)
                        ? 'border-rose-500/50 focus:ring-2 focus:ring-rose-500/20' 
                        : 'border-white/5 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 group-hover:border-white/10'}`}
                    value={customTokenAddress}
                    onChange={e => setCustomTokenAddress(e.target.value)} 
                  />
                </div>
                {customTokenAddress && !ethers.isAddress(customTokenAddress) && <p className="text-xs text-rose-400 ml-1 font-medium">{t.invalidContractAddress}</p>}
              </div>
            )}

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
                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">
                  {t.balance}: {isBalanceLoading ? <FaSync className="animate-spin text-[8px]" /> : <span className="text-slate-300 font-mono">{parseFloat(balance).toFixed(4)}</span>} {selectedToken.symbol}
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