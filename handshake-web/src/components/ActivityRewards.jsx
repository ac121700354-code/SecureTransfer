import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ethers } from 'ethers';
import { FaCalendarCheck, FaGift, FaTrophy, FaCoins, FaCheckCircle, FaSpinner, FaBolt } from 'react-icons/fa';
import { useToast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';

const ActivityRewards = ({ account, provider, chainId, activeConfig, onRewardClaimed, miniMode }) => {
  const toast = useToast();
  const { t } = useLanguage();
  
  // Loading States
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [claimingNonces, setClaimingNonces] = useState([]); // Array of nonces currently claiming

  const [streak, setStreak] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState(0);
  const [maxStreak, setMaxStreak] = useState(7); // Default 7, will fetch from contract
  const [rewardContract, setRewardContract] = useState(null);
  
  // Get Token Symbol from Config
  const tokenSymbol = activeConfig?.tokens?.find(t => t.address !== ethers.ZeroAddress && t.symbol !== 'USDT' && t.symbol !== 'USDC')?.symbol || "HK";

  // --- Daily Transfer Stats Logic (On-Chain) ---
  const [transferCount, setTransferCount] = useState(0); 
  const [totalTransferCount, setTotalTransferCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // New state to track if data is fully loaded
  const [claimedTiers, setClaimedTiers] = useState([]);
  const [contractBalance, setContractBalance] = useState(0); // Add state for contract balance
  const [isBalanceLow, setIsBalanceLow] = useState(false);

  // Fetch transfer count from Escrow Contract directly (Optimized)
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
            
        // Setup Contract
        const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, rpcProvider);

        // Time Calculation
        const now = new Date();
        const currentDay = Math.floor(now.getTime() / 1000 / 86400);

        // Fetch Data in Parallel
        const [daily, total] = await Promise.all([
            escrowContract.dailyTransferCounts(account, currentDay),
            escrowContract.totalTransferCounts(account)
        ]);

        setTransferCount(Number(daily));
        setTotalTransferCount(Number(total));

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

  // Mock Tasks Configuration (Static IDs) -> Replaced by Dynamic Loading
  const [tasksConfig, setTasksConfig] = useState([]);

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
      // 0. Fetch Tasks Configuration from Contract
      // (Optimization: In production, maybe cache this or pass as props)
      let currentTasks = tasksConfig;
      if (currentTasks.length === 0) {
          try {
            const tasksRaw = await contract.getAllTasks();
            // Transform Struct to JS Object
            // struct TaskConfig { uint256 taskId; uint256 rewardAmount; uint256 targetCount; TaskType taskType; }
            currentTasks = tasksRaw.map(t => ({
                id: Number(t.taskId),
                count: Number(t.targetCount),
                reward: ethers.formatEther(t.rewardAmount),
                type: Number(t.taskType) // 0=DAILY, 1=CUMULATIVE
            }));
            // Sort by target count
            currentTasks.sort((a, b) => a.count - b.count);
            setTasksConfig(currentTasks);
          } catch(e) {
              console.error("Failed to fetch tasks config", e);
          }
      }

      // 1. Fetch Check-in Data
      const info = await contract.userCheckIns(userAddress);
      setStreak(Number(info.streak));
      setLastCheckIn(Number(info.lastCheckInTime));
      
      // 1.1 Fetch Max Streak Config
      try {
          const max = await contract.maxStreakReward();
          setMaxStreak(Number(max));
      } catch(e) {}
      
      // 2. Fetch Daily Claim Status
      // We check the status of each task for "Today"
      const claims = [];
      const now = new Date();
      const currentDay = Math.floor(now.getTime() / 1000 / 86400);

      for (const task of currentTasks) {
          // Check userTaskStatus(address, taskId)
          // Contract returns: lastClaimedDay (for DAILY) or 1 (for CUMULATIVE)
          const status = await contract.userTaskStatus(userAddress, task.id);
          const statusNum = Number(status);

          if (task.type === 0) { // DAILY
             // If stored day == current day, it's claimed
             if (statusNum === currentDay) {
                 claims.push(task.id);
             }
          } else { // CUMULATIVE
             // If status > 0, it's claimed
             if (statusNum > 0) {
                 claims.push(task.id);
             }
          }
      }
      setClaimedTiers(claims);

      // 3. Fetch Contract Balance (Reward Pool)
      try {
        // Contract variable is 'token', not 'rewardToken'
        const rewardTokenAddress = await contract.token(); 
        const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
        
        // Use contract.runner (provider/signer) for read-only call
        const rewardToken = new ethers.Contract(rewardTokenAddress, erc20Abi, contract.runner);
        
        // Ethers v6 uses 'target', v5 uses 'address'
        const targetAddr = contract.target || contract.address;
        
        const bal = await rewardToken.balanceOf(targetAddr); 
        const balFmt = Number(ethers.formatEther(bal));
        setContractBalance(balFmt);
        
        // If balance < 100 HK (arbitrary low threshold), mark as low
        if (balFmt < 100) {
            setIsBalanceLow(true);
        } else {
            setIsBalanceLow(false);
        }
      } catch (err) {
          console.warn("Failed to fetch reward pool balance:", err);
          // If fetch fails, we shouldn't assume it's low unless we want to block actions.
          // Better to show 0 or unknown. For safety, let's keep isBalanceLow false but log error.
      }

      setDataLoaded(true); // Mark data as loaded

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
    
    if (!account) {
        toast.error(t.pleaseConnectWallet);
        return;
    }

    if (!rewardContract) {
        toast.error(t.wrongNetwork || "Contract not connected! Check network.");
        return;
    }
    setCheckInLoading(true);
    try {
      const tx = await rewardContract.checkIn();
      toast.info(t.checkInSubmitted);
      await tx.wait();

      // Calculate reward for this check-in
      // Logic: Cycle (1..maxStreak)
      // Note: 'streak' state here is OLD streak. We need next streak.
      const nextStreak = streak + 1;
      const cycleDay = (nextStreak - 1) % maxStreak + 1;
      const rewardAmt = cycleDay;
      
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

  const handleClaimReward = async (task, nonce) => {
    if (!account) {
        toast.error(t.pleaseConnectWallet);
        return;
    }

    if (!rewardContract) {
        toast.error(t.wrongNetwork || "Contract not connected!");
        return;
    }
    
    // Add nonce to claiming list
    setClaimingNonces(prev => [...prev, nonce]);
    
    try {
      // Call New Contract Function: claimTaskReward(uint256 taskId)
      // Note: rewardAmount is now handled on-chain for security
      const tx = await rewardContract.claimTaskReward(task.id);
      
      toast.info(t.claiming);
      await tx.wait();
      toast.success(t.claimSuccess.replace('{amount}', task.reward).replace('{symbol}', tokenSymbol));
      
      setClaimedTiers(prev => [...prev, nonce]); // Update local state immediately
      
      // Notify parent to refresh balance
      if (onRewardClaimed) onRewardClaimed();

      fetchUserData(rewardContract, account); // Refetch from chain to be sure
    } catch (error) {
      console.error(error);
      const msg = error.reason || error.message || "Claim failed";
      
      if (msg.includes("Task not completed")) {
          toast.error(t.taskNotCompleted || "Task not completed yet!");
      } else if (msg.includes("Already claimed today")) {
          toast.error(t.alreadyClaimed || "Already claimed today!");
          setClaimedTiers(prev => [...prev, nonce]);
      } else if (msg.includes("Insufficient reward balance")) {
          toast.error(t.insufficientRewardBalance);
      } else {
          toast.error(msg);
      }
    } finally {
      // Remove nonce from claiming list
      setClaimingNonces(prev => prev.filter(n => n !== nonce));
    }
  };

  // --- View Mode Logic ---
  const [isOpen, setIsOpen] = useState(false);
  const [totalPotentialReward, setTotalPotentialReward] = useState(0);
  const [claimableToday, setClaimableToday] = useState(0);

  useEffect(() => {
    // Calculate max reward when tasks load
    if (tasksConfig.length > 0) {
        let total = 0;
        let todayClaimable = 0;

        // 1. Calculate Check-in Reward for Today (if not checked in)
        if (!isCheckedInToday) {
             const nextStreak = streak + 1;
             const cycleDay = (nextStreak - 1) % maxStreak + 1;
             todayClaimable += cycleDay;
        }

        tasksConfig.forEach(t => {
            const val = parseFloat(t.reward);
            
            // Total Potential Calculation
            if (t.type === 1) total += val; // Cumulative
            else total += val * 30; // Daily * 30 days

            // Today Claimable Calculation
            const currentCount = t.type === 0 ? transferCount : totalTransferCount;
            const isCompleted = currentCount >= t.count;
            const isClaimed = claimedTiers.includes(t.id);
            
            // If completed but NOT claimed, it's claimable now
            if (isCompleted && !isClaimed) {
                todayClaimable += val;
            }
            // If DAILY task and NOT completed yet, it's potentially claimable today
            else if (t.type === 0 && !isCompleted && !isClaimed) {
                todayClaimable += val;
            }
        });
        
        setTotalPotentialReward(Math.floor(total));
        setClaimableToday(Number(todayClaimable.toFixed(1)));
    }
  }, [tasksConfig, isCheckedInToday, streak, maxStreak, transferCount, totalTransferCount, claimedTiers]);

  // --- Mini Mode (Icon Only) ---
  const MiniModeIcon = () => (
      <button 
          onClick={() => setIsOpen(true)}
          className={`
            relative group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all active:scale-95
            ${claimableToday > 0 
                ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]' 
                : 'bg-slate-800/50 border border-white/5 hover:bg-slate-700/50'}
          `}
          title={t.activityRewardsTitle}
      >
          <div className="relative">
            {claimableToday > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                </span>
            )}
            <FaGift className={`${claimableToday > 0 ? 'text-yellow-400' : 'text-slate-400 group-hover:text-white'}`} size={14} />
          </div>
          
          {claimableToday > 0 && (
              <span className="text-xs font-bold text-yellow-100 group-hover:text-white tracking-wide">
                  {t.rewardsAvailable?.replace('{amount}', claimableToday) || `${claimableToday} HK`}
              </span>
          )}
      </button>
  );

  if (!isOpen) {
      if (miniMode) {
          return <MiniModeIcon />;
      }
      return null; 
  }

  // Use Portal to render the modal at the document body level
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden bg-slate-900 rounded-2xl border border-white/10 shadow-2xl shadow-black/50 flex flex-col">
            {/* Close Button - Sticky/Fixed Header */}
            <div className="absolute top-0 right-0 z-20 p-4 bg-gradient-to-b from-slate-900 via-slate-900/80 to-transparent">
                <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors shadow-lg border border-white/5"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-5 pr-12">
                    <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-2 rounded-lg shadow-lg shadow-pink-500/20">
                        <FaGift className="text-white text-lg" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{t.activityRewardsTitle}</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-slate-400 text-xs">{t.activityRewardsDesc}</p>
                            {/* Pool Balance Indicator */}
                            <div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${isBalanceLow ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isBalanceLow ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                {isBalanceLow ? (t.lowPoolBalance || "Low Pool Balance") : `${t.poolBalance || "Pool"}: ${Math.floor(contractBalance)} ${tokenSymbol}`}
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                {isBalanceLow && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3">
                        <FaBolt className="text-red-400" />
                        <div className="text-xs text-red-200">
                            <strong>{t.rewardPoolEmptyTitle || "Reward Pool Empty!"}</strong> {t.rewardPoolEmptyDesc || "The contract has insufficient funds. Please come back tomorrow or contact support."}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4">

        {/* 1. Daily Check-In (Top Full Width) */}
        <div className={`bg-slate-800/40 rounded-xl p-4 border border-white/5 ${isBalanceLow ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-0.5">
                    <FaCalendarCheck className="text-blue-400" /> 
                    {t.dailyCheckIn}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                        {t.checkInRules.replace('{symbol}', tokenSymbol)}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-white/5">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t.streak}</div>
                    <div className="text-xl font-black text-blue-400 leading-none">{streak}<span className="text-[10px] text-slate-600 font-medium ml-1">{t.days}</span></div>
                </div>
            </div>

            {/* 7-Day Grid Layout */}
            <div className="grid grid-cols-7 gap-1.5 md:gap-3 mb-4">
                {Array.from({length: maxStreak}, (_, i) => i + 1).map(day => {
                    // Logic: N-day cycle display
                    const currentCycleDay = (streak - 1) % maxStreak + 1;
                    const isUnlocked = streak > 0 && day <= currentCycleDay;
                    const isNext = streak > 0 ? (day === currentCycleDay + 1) : (day === 1);
                    const effectiveIsNext = (streak % maxStreak === 0) ? (day === 1) : isNext;
                    
                    const rewardAmount = day; 
                    
                    return (
                        <div key={day} className={`
                            relative group flex flex-col items-center justify-center py-2 rounded-lg border transition-all
                            ${isUnlocked 
                                ? 'bg-blue-500/10 border-blue-500/30' 
                                : effectiveIsNext
                                    ? 'bg-slate-800 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.15)] scale-105'
                                    : 'bg-slate-900/50 border-white/5 opacity-60'}
                        `}>
                            {/* Day Number / Check Icon */}
                            <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all mb-1
                                ${isUnlocked 
                                    ? 'bg-blue-500 border-blue-500 text-white' 
                                    : effectiveIsNext
                                        ? 'bg-transparent border-blue-400 text-blue-400 animate-pulse'
                                        : 'bg-slate-800 border-slate-700 text-slate-600'}
                            `}>
                                {isUnlocked ? <FaCheckCircle /> : day}
                            </div>
                            
                            {/* Reward Text */}
                            <div className={`
                                text-[10px] font-bold whitespace-nowrap
                                ${effectiveIsNext ? 'text-blue-400' : 'text-slate-500'}
                            `}>
                                +{rewardAmount}
                            </div>
                            <div className={`text-[8px] font-medium uppercase mt-0.5 ${effectiveIsNext ? 'text-blue-400/80' : 'text-slate-600'}`}>{tokenSymbol}</div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleCheckIn}
                disabled={checkInLoading || (account ? (!rewardContract || isCheckedInToday) : false)}
                className={`
                    w-full py-2.5 rounded-lg font-bold text-xs tracking-wide transition-all flex justify-center items-center gap-2
                    ${isCheckedInToday
                        ? 'bg-slate-700/50 text-slate-400 cursor-default border border-white/5'
                        : checkInLoading 
                            ? 'bg-slate-700 text-slate-400 cursor-wait' 
                            : !account
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                : !rewardContract 
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'}
                `}
            >
                {checkInLoading 
                    ? <FaSpinner className="animate-spin" /> 
                    : isCheckedInToday 
                        ? <><FaCheckCircle /> {t.checkedIn}</> 
                        : (account && !rewardContract ? t.wrongNetwork : t.checkInNow)
                }
            </button>
        </div>

        {/* 2. Tasks List (Bottom Full Width) */}
        <div className={`bg-slate-800/40 rounded-xl p-5 border border-white/5 flex flex-col h-full ${isBalanceLow ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <FaTrophy className="text-yellow-500" /> 
                        {t.dailyMissions}
                    </h3>
                    
                    <div className="flex gap-2">
                        {/* Daily Badge */}
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
            </div>

            {/* Task List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tasksConfig.map((task) => {
                const currentCount = task.type === 0 ? transferCount : totalTransferCount;
                const isCompleted = currentCount >= task.count;
                const isClaimed = claimedTiers.includes(task.id);
                const progress = Math.min(100, (currentCount / task.count) * 100);
                const isThisLoading = claimingNonces.includes(task.id);
                
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
                                    {task.type === 0 ? t.completeTransfers.replace('{count}', task.count) : t.totalTransfers.replace('{count}', task.count)}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                                    <FaCoins className="text-yellow-500" size={8} /> 
                                    <span className="text-yellow-500/90">{task.reward} {tokenSymbol}</span>
                                </div>
                            </div>
                        </div>

                        <button
                        onClick={() => handleClaimReward(task, task.id)}
                        disabled={!dataLoaded || (account ? (!isCompleted || isClaimed || isThisLoading) : false)}
                        className={`
                            px-3 py-1.5 rounded text-[10px] font-bold transition-all shrink-0 min-w-[60px] flex justify-center
                            ${!dataLoaded
                                ? 'bg-slate-800 text-slate-600 cursor-wait border border-white/5'
                                : isClaimed 
                                    ? 'bg-transparent text-green-500 cursor-default' 
                                    : (!account || isCompleted)
                                        ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-md shadow-yellow-500/20' 
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'}
                        `}
                        >
                        {isThisLoading || !dataLoaded ? (
                            <FaSpinner className="animate-spin text-slate-500" />
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
        </div>
    </div>,
    document.body
  );
};

export default ActivityRewards;
