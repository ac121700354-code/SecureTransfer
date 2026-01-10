import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { FaCalendarCheck, FaGift, FaTrophy, FaCoins, FaCheckCircle, FaSpinner, FaBolt } from 'react-icons/fa';
import { useToast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';

// Test Private Key for Debugging (Hardhat Account #0)
// In production, this signature would come from a secure backend API
const DEBUG_SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ActivityRewards = ({ account, provider, chainId, activeConfig, onRewardClaimed }) => {
  const toast = useToast();
  const { t } = useLanguage();
  
  // Loading States
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [claimingNonces, setClaimingNonces] = useState([]); // Array of nonces currently claiming

  const [streak, setStreak] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState(0);
  const [rewardContract, setRewardContract] = useState(null);
  
  // Get Token Symbol from Config
  const tokenSymbol = activeConfig?.tokens?.find(t => t.address !== ethers.ZeroAddress && t.symbol !== 'USDT' && t.symbol !== 'USDC')?.symbol || "HK";

  // --- Daily Transfer Stats Logic (On-Chain) ---
  const [transferCount, setTransferCount] = useState(0); 
  const [statsLoading, setStatsLoading] = useState(true);
  const [claimedTiers, setClaimedTiers] = useState([]);

  // Fetch transfer count from Escrow Contract logs
  const fetchOnChainTransferStats = async () => {
    if (!account || !activeConfig?.contracts?.EscrowProxy || !provider) {
        setStatsLoading(false);
        return;
    }
    
    setStatsLoading(true);

    try {
        const escrowAddress = activeConfig.contracts.EscrowProxy.address;
        const escrowAbi = activeConfig.contracts.EscrowProxy.abi;

        // Initialize RPC Provider
        const rpcUrl = activeConfig.rpcUrl;
        const rpcProvider = rpcUrl 
            ? new ethers.JsonRpcProvider(rpcUrl) 
            : new ethers.BrowserProvider(window.ethereum);
            
        // Setup Contract and Filter
        const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, rpcProvider);
        const filter = escrowContract.filters.TransferInitiated(null, account);

        // Time Calculation
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startOfDayTimestamp = Math.floor(now.getTime() / 1000);

        // --- Optimized Back-Scanning Strategy ---
        const currentBlock = await rpcProvider.getBlockNumber();
        
        // Strategy: Optimistically try to fetch ~1 day of blocks in one go.
        // If it fails (Rate Limit), the loop will catch it and halve the chunk size.
        const BLOCKS_PER_DAY = 30000; // ~24h on BSC (3s block time)
        const MAX_SEARCH_BLOCKS = 30000; // Only look back 24h as requested
        
        let currentChunkSize = BLOCKS_PER_DAY; // Start big!
        let scanEnd = currentBlock;
        let allLogs = [];
        let isDone = false;
        
        // Calculate hard stop block
        const stopBlockLimit = Math.max(0, currentBlock - MAX_SEARCH_BLOCKS);

        console.log(`[Stats] Starting scan. Block: ${currentBlock}, Target: ${new Date(startOfDayTimestamp * 1000).toLocaleTimeString()}`);

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        while (scanEnd > stopBlockLimit && !isDone) {
            // Determine scan range
            const scanStart = Math.max(stopBlockLimit, scanEnd - currentChunkSize);
            
            try {
                // Fetch logs
                const chunkLogs = await escrowContract.queryFilter(filter, scanStart, scanEnd);
                
                if (chunkLogs.length > 0) {
                    // Sort: Newest first
                    chunkLogs.sort((a, b) => b.blockNumber - a.blockNumber);
                    
                    // Check if we went back far enough (past midnight)
                    const oldestLogBlock = await rpcProvider.getBlock(chunkLogs[chunkLogs.length - 1].blockNumber);
                    if (oldestLogBlock.timestamp < startOfDayTimestamp) {
                        isDone = true; 
                    }
                    allLogs = [...allLogs, ...chunkLogs];
                } else {
                    // Empty chunk? Check block time to see if we passed midnight
                    const startBlockObj = await rpcProvider.getBlock(scanStart);
                    if (startBlockObj && startBlockObj.timestamp < startOfDayTimestamp) {
                        isDone = true;
                    }
                }

                // Success! Move pointer back
                scanEnd = scanStart - 1;
                
                // Optional: If we succeeded with a small chunk, maybe try increasing it slightly? 
                // For now, keep it stable.

            } catch (err) {
                 const isRateLimit = err?.message?.includes("rate limit") || err?.error?.message?.includes("rate limit") || err?.info?.error?.code === -32005;
                 
                 if (isRateLimit) {
                    // Adaptive Retry: Halve the chunk size
                    const newSize = Math.floor(currentChunkSize / 2);
                    console.warn(`[Stats] Rate limit at ${currentChunkSize}. Retrying with ${newSize}...`);
                    
                    if (newSize > 1000) {
                        currentChunkSize = newSize;
                        await sleep(1000); // Cooldown
                        continue; // Retry same loop with smaller size (scanEnd didn't change)
                    } else {
                        console.warn("[Stats] Rate limit persistent. Stopping scan.");
                        isDone = true;
                    }
                 } else if (err?.message?.includes("pruned")) {
                    console.warn("[Stats] History pruned. Stopping.");
                    isDone = true;
                 } else {
                    console.warn("[Stats] Unknown error:", err);
                    // Skip this failed chunk to avoid infinite loop, but this means missing data
                    scanEnd = scanStart - 1; 
                 }
            }
        }

        // Final filtering: Ensure logs are actually from today
        // (We might have fetched a few from yesterday in the last chunk)
        const validLogs = [];
        for (const log of allLogs) {
             try {
                const block = await rpcProvider.getBlock(log.blockNumber);
                if (block && block.timestamp >= startOfDayTimestamp) {
                    validLogs.push(log);
                }
             } catch(e) {}
        }
        
        console.log(`[Stats] Found ${validLogs.length} transfers today.`);
        setTransferCount(validLogs.length);

    } catch (e) {
        console.warn("[Stats] Failed to fetch:", e);
    } finally {
        setStatsLoading(false);
    }
  };

  useEffect(() => {
      // Fetch initially
      fetchOnChainTransferStats();

      // Also listen for local event for immediate UI update
      const handleTransferUpdate = () => {
          // Wait a bit for indexing? Or just optimistic update + refetch
          setTransferCount(prev => prev + 1); 
          // Ideally we re-fetch after a delay to confirm
          setTimeout(fetchOnChainTransferStats, 5000);
      };

      window.addEventListener('user_transfer_completed', handleTransferUpdate);
      return () => {
          window.removeEventListener('user_transfer_completed', handleTransferUpdate);
      };
  }, [account, activeConfig, provider]);

  // Debug Helper
  const debugIncrement = () => {
      setTransferCount(c => c + 1);
  };

  useEffect(() => {
      if (activeConfig && activeConfig.contracts && activeConfig.contracts.ActivityRewards) {
        const contractData = activeConfig.contracts.ActivityRewards;
        
        const initContract = async () => {
            // Use the passed 'provider' prop which contains the specific wallet object (MetaMask, OKX, etc.)
            // Fallback to window.ethereum only if provider prop is missing
            const targetProvider = provider || window.ethereum;
            
            if (account && targetProvider) {
                try {
                    // Wrap the specific provider object
                    const browserProvider = new ethers.BrowserProvider(targetProvider);
                    const signer = await browserProvider.getSigner();
                    
                    const contract = new ethers.Contract(contractData.address, contractData.abi, signer);
                    setRewardContract(contract);
                    fetchUserData(contract, account);
                    console.log("ActivityRewards Contract Connected:", contractData.address);
                } catch (e) {
                    console.error("Contract init failed:", e);
                }
            }
        };

        initContract();
      } else {
        console.warn("ActivityRewards config missing for chain", chainId);
        setRewardContract(null);
    }
  }, [activeConfig, account, provider, chainId]);

  // Mock Tasks Configuration (Static IDs)
  const TASKS_CONFIG = [
    { id: 1, count: 1, reward: "2" },
    { id: 2, count: 3, reward: "6" },
    { id: 3, count: 5, reward: "10" },
    { id: 4, count: 10, reward: "20" },
  ];

  // Helper: Generate Daily Nonce (YYYYMMDD + 00 + ID)
  // Uses UTC to match blockchain consistency
  const getDailyNonce = (taskId) => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    // Example: 20250110001
    return Number(`${year}${month}${day}${String(taskId).padStart(3, '0')}`);
  };

  const fetchUserData = async (contract, userAddress) => {
    try {
      // 1. Fetch Check-in Data
      const info = await contract.userCheckIns(userAddress);
      setStreak(Number(info.streak));
      setLastCheckIn(Number(info.lastCheckInTime));
      
      // 2. Fetch Daily Claim Status
      // We check the status of each task for "Today"
      const claims = [];
      for (const task of TASKS_CONFIG) {
          const dailyNonce = getDailyNonce(task.id);
          const isUsed = await contract.usedNonces(userAddress, dailyNonce);
          if (isUsed) {
              claims.push(dailyNonce);
          }
      }
      setClaimedTiers(claims);

    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  };

  // Check if checked in today
  const currentDay = Math.floor(Date.now() / 1000 / 86400);
  const lastCheckInDay = Math.floor(lastCheckIn / 86400);
  const isCheckedInToday = lastCheckIn > 0 && currentDay === lastCheckInDay;

  const handleCheckIn = async () => {
    if (isCheckedInToday) return;
    
    if (!rewardContract) {
        toast.error(t.wrongNetwork || "Contract not connected! Check network.");
        return;
    }
    setCheckInLoading(true);
    try {
      console.log("Submitting check-in...");
      const tx = await rewardContract.checkIn();
      toast.info(t.checkInSubmitted);
      await tx.wait();

      // Calculate reward for this check-in
      // Logic mirrors contract: if (streak > 7) reward = 7 else reward = streak
      // Note: 'streak' state here is OLD streak. We need next streak.
      const nextStreak = streak + 1;
      const rewardAmt = nextStreak > 7 ? 7 : nextStreak;
      
      toast.success(t.checkInSuccess.replace('{amount}', rewardAmt).replace('{symbol}', tokenSymbol));
      
      // Optimistic Update
      setStreak(nextStreak);
      setLastCheckIn(Math.floor(Date.now() / 1000));

      // Notify parent to refresh balance
      if (onRewardClaimed) onRewardClaimed();

      // Delay fetch to allow node propagation
      setTimeout(() => fetchUserData(rewardContract, account), 2000);
    } catch (error) {
      console.error(error);
      const msg = error.reason || error.message || "Check-in failed";
      
      if (msg.includes("Already checked in today")) {
          toast.error(t.alreadyCheckedIn);
          setLastCheckIn(Math.floor(Date.now() / 1000)); 
      } else if (msg.includes("Insufficient reward balance") || msg.includes("transfer amount exceeds balance")) {
          toast.error(t.insufficientRewardBalance);
      } else {
          toast.error(t.checkInFailed);
      }
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleClaimReward = async (amount, nonce) => {
    if (!rewardContract) {
        toast.error(t.wrongNetwork || "Contract not connected!");
        return;
    }
    
    // Add nonce to claiming list
    setClaimingNonces(prev => [...prev, nonce]);
    
    try {
      // --- Adaptive Signer Logic ---
      const debugWallet = new ethers.Wallet(DEBUG_SIGNER_KEY);
      // Ensure chainId is correctly typed for packing
      const chainIdVal = BigInt(chainId);
      let signature;

      let onChainSigner;
      try {
          onChainSigner = await rewardContract.signer();
      } catch (e) {
          console.warn("Could not fetch signer:", e);
      }

      // Determine Signing Strategy
      // 1. If contract signer is a known Debug Key -> Use Local Wallet (Dev Mode)
      // 2. Otherwise -> User signs for themselves (Self-Claim Mode)
      //    (Contract allows recoveredSigner == msg.sender)

      const isDebugSigner = onChainSigner && onChainSigner.toLowerCase() === debugWallet.address.toLowerCase();
      
      if (isDebugSigner) {
          console.log("Using local debug key as signer");
          const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint256", "uint256", "address"],
            [account, amount, nonce, chainIdVal, await rewardContract.getAddress()]
          );
          signature = await debugWallet.signMessage(ethers.getBytes(messageHash));
      } else {
          // Standard User Claim (Self-Signed)
          console.log("Using connected wallet for Self-Claiming");
          
          try {
            const targetProvider = provider || window.ethereum;
            const browserProvider = new ethers.BrowserProvider(targetProvider);
            const signer = await browserProvider.getSigner();
            
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [account, amount, nonce, chainIdVal, await rewardContract.getAddress()]
            );
            signature = await signer.signMessage(ethers.getBytes(messageHash));
          } catch (signErr) {
             console.error("Signing failed:", signErr);
             setClaimingNonces(prev => prev.filter(n => n !== nonce));
             return; // User rejected signature or error
          }
      }

      // 2. Call Contract with generated signature
      const tx = await rewardContract.claimReward(amount, nonce, signature);
      toast.info(t.claiming);
      await tx.wait();
      toast.success(t.claimSuccess.replace('{amount}', ethers.formatEther(amount)).replace('{symbol}', tokenSymbol));
      
      setClaimedTiers(prev => [...prev, nonce]); // Update local state immediately
      
      // Notify parent to refresh balance
      if (onRewardClaimed) onRewardClaimed();

      fetchUserData(rewardContract, account); // Refetch from chain to be sure
    } catch (error) {
      console.error(error);
      const msg = error.reason || error.message || "Claim failed";
      
      if (msg.includes("Insufficient reward balance") || msg.includes("transfer amount exceeds balance")) {
          toast.error(t.insufficientRewardBalance);
      } else {
          toast.error(msg);
      }
    } finally {
      // Remove nonce from claiming list
      setClaimingNonces(prev => prev.filter(n => n !== nonce));
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-1.5 rounded-lg shadow-lg shadow-pink-500/20">
            <FaGift className="text-white text-sm" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{t.activityRewardsTitle}</h2>
            <p className="text-slate-400 text-xs">{t.activityRewardsDesc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Daily Check-In (Compact) */}
        <div className="lg:col-span-4 bg-slate-800/40 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-0.5">
                    <FaCalendarCheck className="text-blue-400" /> 
                    {t.dailyCheckIn}
                    </h3>
                    <p className="text-[10px] text-slate-500 max-w-[200px] leading-tight">
                        {t.checkInRules.replace('{symbol}', tokenSymbol)}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{t.streak}</div>
                    <div className="text-2xl font-black text-blue-400 leading-none">{streak}<span className="text-xs text-slate-600 font-medium ml-0.5">{t.days}</span></div>
                </div>
            </div>

            {/* Stepper for 7 Days */}
            <div className="flex items-center justify-between mb-8 relative px-1">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-700/50 -z-10 rounded-full"></div>
                
                {[1,2,3,4,5,6,7].map(day => {
                    const isUnlocked = day <= streak;
                    const isNext = day === streak + 1;
                    const rewardAmount = day > 7 ? 7 : day;
                    
                    return (
                        <div key={day} className="relative group">
                            <div className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all z-10 cursor-default
                                ${isUnlocked 
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/30' 
                                    : isNext
                                        ? 'bg-slate-800 border-blue-500/50 text-blue-400 animate-pulse'
                                        : 'bg-slate-900 border-slate-700 text-slate-600'}
                            `}>
                                {isUnlocked ? <FaCheckCircle size={10} /> : day}
                            </div>
                            
                            {/* Reward Badge (Hover) - Optional, kept for extra detail if needed, or removed if redundant. Keeping as "tooltip" style is fine. */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                <div className="bg-slate-900 text-[9px] text-white px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap shadow-xl flex items-center gap-1">
                                    <FaCoins className="text-yellow-400" size={8} />
                                    <span>+{rewardAmount} {tokenSymbol}</span>
                                </div>
                                {/* Triangle arrow */}
                                <div className="w-2 h-2 bg-slate-900 border-r border-b border-white/10 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                            </div>
                            
                            {/* Static Reward Label - Always Visible */}
                            <div className={`
                                absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap
                                ${isNext ? 'text-blue-400' : 'text-slate-500'}
                            `}>
                                +{rewardAmount} {tokenSymbol}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleCheckIn}
                disabled={checkInLoading || !rewardContract || isCheckedInToday}
                className={`
                    w-full py-2.5 rounded-lg font-bold text-xs tracking-wide transition-all flex justify-center items-center gap-2
                    ${isCheckedInToday
                        ? 'bg-slate-700/50 text-slate-400 cursor-default border border-white/5'
                        : checkInLoading 
                            ? 'bg-slate-700 text-slate-400 cursor-wait' 
                            : !rewardContract 
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'}
                `}
            >
                {checkInLoading 
                    ? <FaSpinner className="animate-spin" /> 
                    : isCheckedInToday 
                        ? <><FaCheckCircle /> {t.checkedIn}</> 
                        : (!rewardContract ? t.wrongNetwork : t.checkInNow)
                }
            </button>
        </div>

        {/* 2. Tasks List (Compact) */}
        <div className="lg:col-span-8 bg-slate-800/40 rounded-xl p-4 border border-white/5 flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <FaTrophy className="text-yellow-500" /> 
                        {t.dailyMissions}
                    </h3>
                    
                    {/* Simple Text Badge */}
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5
                        ${transferCount > 0 
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                            : 'bg-slate-800 border-white/5 text-slate-500'}
                    `}>
                        {statsLoading ? (
                            <FaSpinner className="animate-spin text-[10px]" />
                        ) : (
                            <>
                                {transferCount > 0 && <FaBolt className="animate-pulse text-[9px]" />}
                                {transferCount > 0 
                                    ? t.transfersToday.replace('{count}', transferCount)
                                    : t.noTransfersToday}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TASKS_CONFIG.map((task) => {
                const dailyNonce = getDailyNonce(task.id);
                const isCompleted = transferCount >= task.count;
                const isClaimed = claimedTiers.includes(dailyNonce);
                const progress = Math.min(100, (transferCount / task.count) * 100);
                const isThisLoading = claimingNonces.includes(dailyNonce);
                
                return (
                <div key={task.id} className={`
                    relative p-3 rounded-lg border transition-all duration-200 overflow-hidden
                    ${isCompleted 
                        ? 'bg-slate-700/30 border-white/10' 
                        : 'bg-slate-800/30 border-transparent'}
                `}>
                    {/* Progress Bar Background */}
                    <div 
                        className="absolute bottom-0 left-0 h-0.5 bg-yellow-500/50 transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                    ></div>

                    <div className="flex items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0
                                ${isCompleted 
                                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' 
                                    : 'bg-slate-800 border-slate-700 text-slate-600'}
                            `}>
                                {task.count}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-300 truncate">
                                    {t.completeTransfers.replace('{count}', task.count)}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                                    <FaCoins className="text-yellow-500" size={8} /> 
                                    <span className="text-yellow-500/90">{task.reward} {tokenSymbol}</span>
                                </div>
                            </div>
                        </div>

                        <button
                        onClick={() => handleClaimReward(ethers.parseEther(task.reward), dailyNonce)}
                        disabled={!isCompleted || isClaimed || isThisLoading}
                        className={`
                            px-3 py-1.5 rounded text-[10px] font-bold transition-all shrink-0 min-w-[60px] flex justify-center
                            ${isClaimed 
                                ? 'bg-transparent text-green-500 cursor-default' 
                                : isCompleted 
                                    ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-md shadow-yellow-500/20' 
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'}
                        `}
                        >
                        {isThisLoading ? (
                            <FaSpinner className="animate-spin text-slate-900" />
                        ) : isClaimed ? (
                            <span className="flex items-center gap-1"><FaCheckCircle /> {t.claimed}</span>
                        ) : t.claim}
                        </button>
                    </div>
                </div>
                );
            })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityRewards;
