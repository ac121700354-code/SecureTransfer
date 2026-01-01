import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { FaPaperPlane, FaWallet, FaCheckCircle, FaExclamationTriangle, FaChevronDown, FaLayerGroup, FaCoins, FaDollarSign, FaQuestionCircle, FaSync } from 'react-icons/fa';
import config from './config.json';
import { useToast } from './components/Toast';

const NATIVE_TOKEN = ethers.ZeroAddress;
const MAX_ACTIVE_TRANSFERS = 10;

const TOKENS = [
  { symbol: "BNB", name: "BNB", address: NATIVE_TOKEN, logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=035" },
  { symbol: "BFR", name: "Buffer Token", address: config.contracts.BufferToken.address, logo: "/tokens/bfr-logo.svg?v=12" },
  { symbol: "USDT", name: "Tether USD", address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", logo: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=035" },
  { symbol: "USDC", name: "USD Coin", address: "0x64544969ed7EBf5f083679233325356EbE738930", logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=035" }
];

export default function InitiateTransfer({ account, onTransactionSuccess, refreshBalanceTrigger, activeCount = 0 }) {
  const toast = useToast();
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  // const [step, setStep] = useState(0); // 移除 step 状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // 获取余额逻辑
  useEffect(() => {
    if (!account) {
        setBalance("0");
        return;
    }

    const fetchBalance = async () => {
        setIsBalanceLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
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
  }, [account, selectedToken, customTokenAddress, refreshBalanceTrigger]);

  // --- 表单验证逻辑 ---
  const isAddressValid = ethers.isAddress(receiver);
  const isTokenAddressValid = selectedToken.address || ethers.isAddress(customTokenAddress);
  const isAmountValid = amount && !isNaN(amount) && parseFloat(amount) > 0;
  const canProceed = isAddressValid && isAmountValid && isTokenAddressValid;
  const isLimitReached = activeCount >= MAX_ACTIVE_TRANSFERS;

  useEffect(() => {
    if (isLimitReached) {
      setError(`达到最大待处理交易限制 (${MAX_ACTIVE_TRANSFERS})。请先处理现有交易。`);
    } else {
      setError((prev) => (prev && prev.includes("达到最大待处理交易限制") ? "" : prev));
    }
  }, [isLimitReached]);

  const handleNext = async () => {
    if (isLimitReached) return;
    setError(""); // 清除之前的错误信息

    if (!account) {
      setError("请先连接钱包！");
      return;
    }
    
    if (!canProceed) {
      setError("请填写完整信息！");
      return;
    }

    // if (activeCount >= MAX_ACTIVE_TRANSFERS) {
    //   setError(`达到最大待处理交易限制 (${MAX_ACTIVE_TRANSFERS})。请先处理现有交易。`);
    //   return;
    // }
    
    // 直接开始交易流程
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const escrowContract = new ethers.Contract(config.contracts.EscrowProxy.address, config.contracts.EscrowProxy.abi, signer);
      
      const tokenAddress = selectedToken.address || customTokenAddress;
      const isNative = tokenAddress === NATIVE_TOKEN;
      const decimals = 18; // Assuming 18 for now, can be dynamic in future

      const weiAmount = ethers.parseUnits(amount, decimals);

      if (!isNative) {
        const tokenContract = new ethers.Contract(tokenAddress, config.contracts.BufferToken.abi, signer);
        
        // 0. 预检查：余额是否充足
        if (parseFloat(amount) > parseFloat(balance)) {
          setError(`余额不足！您只有 ${parseFloat(balance).toFixed(4)} ${selectedToken.symbol}`);
          setLoading(false);
          return;
        }

        // 1. 检查并授权
        const allowance = await tokenContract.allowance(account, config.contracts.EscrowProxy.address);
        if (allowance < weiAmount) {
          // 如果授权不足，请求授权
          const approveTx = await tokenContract.approve(config.contracts.EscrowProxy.address, ethers.MaxUint256);
          await approveTx.wait();
        }
      } else {
        // Native Token (BNB)
        // 余额检查
        if (parseFloat(amount) > parseFloat(balance)) {
          setError(`余额不足！您只有 ${parseFloat(balance).toFixed(4)} BNB`);
          setLoading(false);
          return;
        }
      }

      // 2. 发起担保转账
      let overrides = {};
      if (isNative) {
        overrides.value = weiAmount;
      }

      const initiateTx = await escrowContract.initiate(tokenAddress, receiver, weiAmount, overrides);
      const receipt = await initiateTx.wait();
      
      // 解析日志构造乐观更新数据
      let newOrder = null;
      try {
        // 创建 Interface 实例来解析日志
        // 注意：这里假设 abi 包含 TransferInitiated 事件
        const iface = new ethers.Interface(config.contracts.EscrowProxy.abi);
        
        // 遍历日志找到 TransferInitiated
        for (const log of receipt.logs) {
          try {
            // 只尝试解析来自 Escrow 合约的日志
            if (log.address.toLowerCase() === config.contracts.EscrowProxy.address.toLowerCase()) {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'TransferInitiated') {
                  newOrder = {
                    id: parsed.args[0],
                    sender: parsed.args[1],
                    receiver: parsed.args[2],
                    token: parsed.args[3],
                    amount: parsed.args[4],
                    createdAt: parsed.args[5],
                    expiresAt: 0 // 假设不过期，或者根据合约逻辑推断
                  };
                  break;
                }
            }
          } catch (e) { continue; }
        }
      } catch (e) {
        console.warn("Failed to parse logs for optimistic update:", e);
      }

      toast.success("Transaction Initiated Successfully!");
      
      // setStep(0);  // 移除
      setAmount(""); 
      setReceiver("");
      
      if (onTransactionSuccess) {
        // 传递 newOrder 对象给父组件
        // 如果解析失败，回退到原来的逻辑（传递 undefined，触发全量刷新）
        onTransactionSuccess(newOrder); 
      }

    } catch (err) {
      console.error("交易出错:", err);
      let errorMessage = "交易失败";
      
      // 解析常见错误
      if (err.code === 4001) { 
        errorMessage = "您取消了交易。";
      } else if (JSON.stringify(err).includes("Token not whitelisted")) {
        errorMessage = "该代币暂未被合约支持 (Not Whitelisted)";
      } else if (err.reason) {
        errorMessage = "交易失败: " + err.reason;
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
    <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl h-[550px] flex flex-col">
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 shrink-0">
        <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
        New Transaction
      </h2>
      
      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">Asset Type</label>
              <div className="relative">
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
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">Token Contract Address</label>
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
                {customTokenAddress && !ethers.isAddress(customTokenAddress) && <p className="text-xs text-rose-400 ml-1 font-medium">⚠️ Invalid Contract address</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">Receiver Address</label>
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
              {receiver && !isAddressValid && <p className="text-xs text-rose-400 ml-1 font-medium">⚠️ Invalid Ethereum address</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider ml-1">Amount</label>
                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">
                  Balance: {isBalanceLoading ? <FaSync className="animate-spin text-[8px]" /> : <span className="text-slate-300 font-mono">{parseFloat(balance).toFixed(4)}</span>} {selectedToken.symbol}
                </div>
              </div>
              <div className="relative">
                 <input 
                  placeholder="0.00" 
                  type="number" 
                  className={`w-full bg-slate-900/50 border p-4 rounded-xl outline-none transition-all text-2xl font-bold placeholder:text-slate-700
                    ${amount && !isAmountValid 
                      ? 'border-rose-500/50 focus:ring-2 focus:ring-rose-500/20' 
                      : 'border-white/5 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10'}`}
                  value={amount}
                  onChange={e => setAmount(e.target.value)} 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
                  {selectedToken.symbol}
                </div>
              </div>
            </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg flex items-center gap-2">
            <FaExclamationTriangle className="shrink-0" /> {error}
          </div>
        )}

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
              <span className="flex items-center gap-2 animate-pulse"><FaPaperPlane /> Processing...</span>
            ) : !account ? (
              "Connect Wallet First"
            ) : isLimitReached ? (
              `Limit Reached (${activeCount}/${MAX_ACTIVE_TRANSFERS})`
            ) : (
              "Transfer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}