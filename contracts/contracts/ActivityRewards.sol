// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ActivityRewards
 * @notice 处理用户活跃奖励：每日签到、交易挖矿、任务奖励
 */
interface IEscrow {
    function dailyTransferCounts(address user, uint256 day) external view returns (uint256);
    function totalTransferCounts(address user) external view returns (uint256);
}

contract ActivityRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public token;       // 奖励代币 (STP)
    IEscrow public escrow;     // Escrow 合约地址

    // --- 开关控制 ---
    bool public isCheckInActive = true;
    bool public isClaimActive = true;

    // --- 签到数据 ---
    struct UserCheckIn {
        uint256 lastCheckInTime; // 上次签到时间戳
        uint256 streak;          // 连续签到天数
    }
    mapping(address => UserCheckIn) public userCheckIns;

    // --- 领奖记录 (优化：覆盖更新，避免无限增长) ---
    // taskId => lastClaimedDay (Daily任务存储天数，Cumulative任务存储1)
    mapping(address => mapping(uint256 => uint256)) public userTaskStatus;

    // --- 配置常量 ---
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public maxStreakReward = 7; // Max reward cap (e.g. 7 tokens for 7+ day streak)
    // --- 任务奖励配置 ---
    enum TaskType { DAILY, CUMULATIVE }
    // --- 任务奖励配置 ---
    struct TaskConfig {
        uint256 taskId;
        uint256 rewardAmount;
        uint256 targetCount;
        TaskType taskType; 
    }
    // taskId => TaskConfig
    mapping(uint256 => TaskConfig) public tasks;
    uint256[] public taskIds; // 记录所有任务ID以便遍历（可选）

    // 事件
    event CheckIn(address indexed user, uint256 day, uint256 reward);
    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);
    event TaskConfigUpdated(uint256 taskId, uint256 targetCount, uint256 rewardAmount, TaskType taskType);
    event TaskRemoved(uint256 taskId);

    constructor(address _token, address _escrow) Ownable(msg.sender) {
        require(_token != address(0), "Token zero");
        require(_escrow != address(0), "Escrow zero");
        token = IERC20(_token);
        escrow = IEscrow(_escrow);

    }

    // --- 1. 每日签到 (纯链上逻辑) ---
    function checkIn() external nonReentrant {
        require(isCheckInActive, "Check-in disabled");
        
        UserCheckIn storage info = userCheckIns[msg.sender];
        uint256 currentTime = block.timestamp;
        
        uint256 lastDay = info.lastCheckInTime / SECONDS_PER_DAY;
        uint256 currentDay = currentTime / SECONDS_PER_DAY;
        
        require(currentDay > lastDay, "Already checked in today");

        if (currentDay == lastDay + 1) {
            info.streak++;
        } else {
            info.streak = 1;
        }
        
        // 奖励计算：每N天一循环 (1-N天递增，第N+1天重置为1)
        uint256 cycleDay = (info.streak - 1) % maxStreakReward + 1;
        uint256 rewardAmount = cycleDay * 1e18; // 假定代币精度 18

        info.lastCheckInTime = currentTime;

        _safeRewardTransfer(msg.sender, rewardAmount);
        
        emit CheckIn(msg.sender, info.streak, rewardAmount);
    }

    // --- 2. 任务领奖 (每日 + 累计) ---
    // 修复漏洞：改由 taskId 索引配置，前端无需传入 targetCount
    function claimTaskReward(uint256 taskId) external nonReentrant {
        require(isClaimActive, "Claim disabled");
        
        // 1. 获取任务配置
        TaskConfig memory task = tasks[taskId];
        require(task.rewardAmount > 0 && task.targetCount > 0, "Invalid task ID");

        uint256 actualCount;
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;

        if (task.taskType == TaskType.DAILY) {
            // --- 每日任务逻辑 ---
            // 检查今日是否已领
            require(userTaskStatus[msg.sender][taskId] != currentDay, "Already claimed today");
            
            // 查询今日转账数
            actualCount = escrow.dailyTransferCounts(msg.sender, currentDay);

            // 标记今日已领 (覆盖旧数据，Gas更低)
            userTaskStatus[msg.sender][taskId] = currentDay;

        } else {
            // --- 累计任务逻辑 ---
            // 检查是否已领 (状态不为0即为已领)
            require(userTaskStatus[msg.sender][taskId] == 0, "Already claimed");
            
            // 查询历史总转账数
            actualCount = escrow.totalTransferCounts(msg.sender);

            // 标记已领
            userTaskStatus[msg.sender][taskId] = 1;
        }

        require(actualCount >= task.targetCount, "Task not completed");

        // 2. 发放奖励
        _safeRewardTransfer(msg.sender, task.rewardAmount);
        
        // 这里的nonce参数在累计任务中无意义，保留字段兼容性或改为taskId
        emit RewardClaimed(msg.sender, task.rewardAmount, taskId);
    }

    // --- 内部安全转账 ---
    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 balance = token.balanceOf(address(this));
        require(balance >= amount, "Insufficient reward balance");
        token.safeTransfer(to, amount);
    }

    // --- 查询接口 ---
    function getTaskIds() external view returns (uint256[] memory) {
        return taskIds;
    }

    function getAllTasks() external view returns (TaskConfig[] memory) {
        uint256 len = taskIds.length;
        TaskConfig[] memory allTasks = new TaskConfig[](len);
        for (uint256 i = 0; i < len; i++) {
            allTasks[i] = tasks[taskIds[i]];
        }
        return allTasks;
    }

    // --- 管理接口 ---
    function setEscrow(address _escrow) external onlyOwner {
        escrow = IEscrow(_escrow);
    }

    function setConfig(bool _checkIn, bool _claim) external onlyOwner {
        isCheckInActive = _checkIn;
        isClaimActive = _claim;
    }

    function setMaxStreakReward(uint256 _max) external onlyOwner {
        maxStreakReward = _max;
    }

    function setTaskConfig(uint256 taskId, uint256 targetCount, uint256 rewardAmount, uint8 taskType) external onlyOwner {
        require(taskType <= 1, "Invalid type");
        _setTask(taskId, targetCount, rewardAmount, TaskType(taskType));
    }

    function removeTask(uint256 taskId) external onlyOwner {
        require(tasks[taskId].targetCount > 0, "Task not found");
        
        delete tasks[taskId];
        
        // Remove from taskIds array (Swap and Pop)
        for (uint256 i = 0; i < taskIds.length; i++) {
            if (taskIds[i] == taskId) {
                taskIds[i] = taskIds[taskIds.length - 1];
                taskIds.pop();
                break;
            }
        }
        
        emit TaskRemoved(taskId);
    }

    function _setTask(uint256 taskId, uint256 targetCount, uint256 rewardAmount, TaskType taskType) internal {
        tasks[taskId] = TaskConfig({
            taskId: taskId,
            targetCount: targetCount,
            rewardAmount: rewardAmount,
            taskType: taskType
        });
        
        // 简单的去重添加逻辑（非关键，仅为了方便查询所有ID）
        bool exists = false;
        for(uint i=0; i<taskIds.length; i++) {
            if(taskIds[i] == taskId) {
                exists = true;
                break;
            }
        }
        if(!exists) {
            taskIds.push(taskId);
        }

        emit TaskConfigUpdated(taskId, targetCount, rewardAmount, taskType);
    }

    // 提取未分发的代币
    function withdraw(address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
