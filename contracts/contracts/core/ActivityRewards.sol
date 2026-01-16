// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

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
    
    // 版本控制
    string private constant VERSION = "1.0.1"; // Updated Version

    IERC20 public token;       // 奖励代币 (STP)
    IEscrow public escrow;     // Escrow 合约地址
    // REMOVED: AggregatorV3Interface internal timestampFeed;

    // --- 开关控制 ---
    bool public isCheckInActive = true;
    bool public isClaimActive = true;
    bool private _paused;
    uint256 public dailyRewardCap = 1000 * 1e18; // 默认每日奖励上限

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
    enum TaskStatus { ACTIVE, LOCKED, COMPLETED }

    // --- 任务奖励配置 ---
    struct TaskConfig {
        uint256 taskId;
        uint256 rewardAmount;
        uint256 targetCount;
        TaskType taskType; 
    }
    // taskId => TaskConfig
    mapping(uint256 => TaskConfig) public tasks;
    mapping(uint256 => TaskStatus) public taskStatus; // 任务状态管理
    mapping(uint256 => uint256) private _taskIdToIndex; // 任务ID到数组索引的映射
    uint256[] public taskIds; // 记录所有任务ID以便遍历
    uint256 private _nextTaskId = 1; // 自动递增任务ID

    // 事件
    event CheckIn(address indexed user, uint256 day, uint256 reward);
    event RewardClaimed(address indexed user, uint256 amount, uint256 taskId, TaskType taskType);
    event TaskConfigUpdated(uint256 taskId, uint256 targetCount, uint256 rewardAmount, TaskType taskType);
    event TaskRemoved(uint256 taskId);
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!_paused, "Paused");
        _;
    }

    // Removed _timestampFeed from constructor
    constructor(address _token, address _escrow) Ownable(msg.sender) {
        require(_token != address(0), "Token zero");
        require(_escrow != address(0), "Escrow zero");
        require(IERC20Metadata(_token).decimals() <= 18, "Unsupported decimals"); // 精度检查
        
        token = IERC20(_token);
        escrow = IEscrow(_escrow);
    }

    // 获取当前天数 (直接使用区块时间)
    function _getCurrentDay() internal view returns (uint256) {
        return block.timestamp / SECONDS_PER_DAY;
    }

    // --- 1. 每日签到 (纯链上逻辑) ---
    function checkIn() external nonReentrant whenNotPaused {
        require(isCheckInActive, "Check-in disabled");
        
        UserCheckIn storage info = userCheckIns[msg.sender];
        uint256 currentTime = block.timestamp;
        
        uint256 lastDay = info.lastCheckInTime / SECONDS_PER_DAY;
        // 修复：使用更可靠的时间源
        uint256 currentDay = _getCurrentDay();
        
        require(currentDay > lastDay, "Already checked in today");

        if (currentDay == lastDay + 1) {
            info.streak++;
        } else {
            info.streak = 1;
        }
        
        // 奖励计算：每N天一循环 (1-N天递增，第N+1天重置为1)
        uint256 cycleDay = (info.streak - 1) % maxStreakReward + 1;
        // 修复：使用代币实际精度计算奖励
        uint256 rewardAmount = cycleDay * (10 ** IERC20Metadata(address(token)).decimals());
        
        // 修复：检查每日奖励上限
        require(rewardAmount <= dailyRewardCap, "Reward exceeds cap");

        info.lastCheckInTime = currentTime;
        
        // 修复：转账前检查余额
        require(token.balanceOf(address(this)) >= rewardAmount, "Insufficient reward balance");
        _safeRewardTransfer(msg.sender, rewardAmount);
        
        emit CheckIn(msg.sender, info.streak, rewardAmount);
    }

    /// @notice 领取任务奖励
    /// @dev 调用前需通过getTaskIds()获取可用任务ID，或通过getTaskProgress()查看进度
    /// @param taskId 任务ID（通过getTaskIds获取）
    function claimTaskReward(uint256 taskId) external nonReentrant whenNotPaused {
        require(isClaimActive, "Claim disabled");
        _claimTaskReward(msg.sender, taskId);
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

    function getTaskProgress(uint256 taskId) external view returns (uint256 actualCount, uint256 targetCount, bool completed) {
        TaskConfig memory task = tasks[taskId];
        if (task.targetCount == 0) return (0, 0, false);
        
        targetCount = task.targetCount;
        
        if (task.taskType == TaskType.DAILY) {
            uint256 currentDay = _getCurrentDay();
            actualCount = escrow.dailyTransferCounts(msg.sender, currentDay);
        } else {
            actualCount = escrow.totalTransferCounts(msg.sender);
        }

        completed = actualCount >= targetCount;
        
        // 检查是否已领取
        if (task.taskType == TaskType.DAILY) {
            uint256 currentDay = _getCurrentDay();
            if (userTaskStatus[msg.sender][taskId] == currentDay) {
                completed = true; // 已领取视为完成
            }
        } else {
            if (userTaskStatus[msg.sender][taskId] != 0) {
                completed = true;
            }
        }
        
        return (actualCount, targetCount, completed);
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

    function addTask(uint256 targetCount, uint256 rewardAmount, TaskType taskType) external onlyOwner {
        uint256 taskId = _nextTaskId++;
        _setTask(taskId, targetCount, rewardAmount, taskType);
    }

    function setTaskConfig(uint256 taskId, uint256 targetCount, uint256 rewardAmount, uint8 taskType) external onlyOwner {
        require(taskType <= 1, "Invalid type");
        // 修复：检查任务是否被锁定
        require(taskStatus[taskId] != TaskStatus.LOCKED, "Task locked");
        _setTask(taskId, targetCount, rewardAmount, TaskType(taskType));
    }

    function removeTask(uint256 taskId) external onlyOwner {
        // 修复：使用 O(1) 移除逻辑
        require(tasks[taskId].targetCount > 0, "Task not found");
        
        uint256 index = _taskIdToIndex[taskId];
        require(index < taskIds.length && taskIds[index] == taskId, "Task index mismatch");

        uint256 lastTaskId = taskIds[taskIds.length - 1];

        // 将最后一个元素移到被删除的位置
        taskIds[index] = lastTaskId;
        _taskIdToIndex[lastTaskId] = index; // 更新移动元素的索引

        taskIds.pop(); // 移除末尾
        
        delete _taskIdToIndex[taskId]; // 删除被删除元素的索引
        delete tasks[taskId];
        delete taskStatus[taskId];
        
        emit TaskRemoved(taskId);
    }

    function _setTask(uint256 taskId, uint256 targetCount, uint256 rewardAmount, TaskType taskType) internal {
        tasks[taskId] = TaskConfig({
            taskId: taskId,
            targetCount: targetCount,
            rewardAmount: rewardAmount,
            taskType: taskType
        });
        
        // 如果是新任务（不在数组中），则添加到数组
        // 通过检查 _taskIdToIndex 是否存在（或为0且首元素匹配）来判断
        // 更简单的方式是：仅当通过 addTask 添加时才 push，但 setTaskConfig 可能修改现有任务
        // 由于我们引入了 addTask，setTaskConfig 应仅用于更新现有任务
        // 但为了兼容，我们检查 taskIds
        
        // 优化：使用 mapping 维护索引
        bool exists = false;
        if (taskIds.length > 0) {
            uint256 index = _taskIdToIndex[taskId];
            if (index < taskIds.length && taskIds[index] == taskId) {
                exists = true;
            }
        }

        if (!exists) {
            _taskIdToIndex[taskId] = taskIds.length;
            taskIds.push(taskId);
            taskStatus[taskId] = TaskStatus.ACTIVE;
        }

        emit TaskConfigUpdated(taskId, targetCount, rewardAmount, taskType);
    }

    // 提取未分发的代币
    function withdraw(address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
    
    // --- 安全建议实现 ---
    
    // 设置暂停状态
    function setPaused(bool paused) external onlyOwner {
        _paused = paused;
        if (paused) {
            emit Paused(msg.sender);
        } else {
            emit Unpaused(msg.sender);
        }
    }
    
    // 设置每日奖励上限
    function setDailyRewardCap(uint256 cap) external onlyOwner {
        dailyRewardCap = cap;
    }
    
    // 批量领取任务奖励
    function batchClaimTaskRewards(uint256[] calldata _taskIds) external nonReentrant whenNotPaused {
        require(isClaimActive, "Claim disabled");
        for (uint256 i = 0; i < _taskIds.length; i++) {
            // 复用内部逻辑，但要注意重入锁已在外层开启，需避免调用 external 函数
            // 由于 claimTaskReward 是 external，这里我们需要提取内部逻辑或直接复制逻辑
            // 为了代码复用和安全性，建议提取内部函数 _claimTaskReward
            _claimTaskReward(msg.sender, _taskIds[i]);
        }
    }
    
    // 内部领取逻辑 (提取自 claimTaskReward)
    function _claimTaskReward(address user, uint256 taskId) internal {
        // 1. 获取任务配置
        TaskConfig memory task = tasks[taskId];
        require(task.rewardAmount > 0 && task.targetCount > 0, "Invalid task ID");

        uint256 actualCount;
        uint256 currentDay = _getCurrentDay();

        if (task.taskType == TaskType.DAILY) {
            // --- 每日任务逻辑 ---
            require(userTaskStatus[user][taskId] != currentDay, "Already claimed today");
            actualCount = escrow.dailyTransferCounts(user, currentDay);
            userTaskStatus[user][taskId] = currentDay;
        } else {
            // --- 累计任务逻辑 ---
            require(userTaskStatus[user][taskId] == 0, "Already claimed");
            actualCount = escrow.totalTransferCounts(user);
            userTaskStatus[user][taskId] = 1;
            taskStatus[taskId] = TaskStatus.COMPLETED;
        }

        require(actualCount >= task.targetCount, "Task not completed");

        // 2. 发放奖励
        require(token.balanceOf(address(this)) >= task.rewardAmount, "Insufficient reward balance");
        _safeRewardTransfer(user, task.rewardAmount);
        
        emit RewardClaimed(user, task.rewardAmount, taskId, task.taskType);
    }
}
