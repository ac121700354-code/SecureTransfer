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
contract ActivityRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public token;       // 奖励代币 (STP)
    address public signer;     // 授权签名者地址 (后端或管理员)

    // --- 开关控制 ---
    bool public isCheckInActive = true;
    bool public isClaimActive = true;

    // --- 签到数据 ---
    struct UserCheckIn {
        uint256 lastCheckInTime; // 上次签到时间戳
        uint256 streak;          // 连续签到天数
    }
    mapping(address => UserCheckIn) public userCheckIns;

    // --- 领奖记录 (防止重放) ---
    // mapping(user => mapping(nonce => bool))
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // --- 配置常量 ---
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public maxStreakReward = 7; // Max reward cap (e.g. 7 tokens for 7+ day streak)

    // 事件
    event CheckIn(address indexed user, uint256 day, uint256 reward);
    event RewardClaimed(address indexed user, uint256 amount, uint256 nonce);

    constructor(address _token, address _signer) Ownable(msg.sender) {
        require(_token != address(0), "Token zero");
        token = IERC20(_token);
        signer = _signer;
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
        
        // 奖励计算：min(streak, maxStreakReward)
        uint256 rewardAmount = info.streak > maxStreakReward ? maxStreakReward : info.streak;
        rewardAmount = rewardAmount * 1e18; // 假定代币精度 18

        info.lastCheckInTime = currentTime;

        _safeRewardTransfer(msg.sender, rewardAmount);
        
        emit CheckIn(msg.sender, info.streak, rewardAmount);
    }

    // --- 2. 通用领奖 (转账奖励/任务奖励) ---
    // 需要后端/前端提供签名证明用户完成了任务
    // 签名内容: keccak256(user, amount, nonce, chainId, contractAddr)
    function claimReward(uint256 amount, uint256 nonce, bytes calldata signature) external nonReentrant {
        require(isClaimActive, "Claim disabled");
        require(!usedNonces[msg.sender][nonce], "Nonce used");
        
        // 验证签名
        bytes32 structHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, block.chainid, address(this)));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(structHash);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);
        
        // Allow centralized signer OR self-signing (for public testing without backend)
        require(recoveredSigner == signer || recoveredSigner == msg.sender, "Invalid signature");

        usedNonces[msg.sender][nonce] = true;
        _safeRewardTransfer(msg.sender, amount);
        
        emit RewardClaimed(msg.sender, amount, nonce);
    }

    // --- 内部安全转账 ---
    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 balance = token.balanceOf(address(this));
        require(balance >= amount, "Insufficient reward balance");
        token.safeTransfer(to, amount);
    }

    // --- 管理接口 ---
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function setConfig(bool _checkIn, bool _claim) external onlyOwner {
        isCheckInActive = _checkIn;
        isClaimActive = _claim;
    }

    function setMaxStreakReward(uint256 _max) external onlyOwner {
        maxStreakReward = _max;
    }

    // 提取未分发的代币
    function withdraw(address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
