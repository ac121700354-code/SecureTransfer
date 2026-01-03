// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// Chainlink 预言机接口定义
interface AggregatorV3Interface {
  function decimals() external view returns (uint8);
  function latestRoundData() external view returns (
    uint80 roundId,
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
  );
}

/**
 * @title 安全握手转账协议 (无收件箱限制版) - UUPS 可升级版
 * @notice 核心机制：付款方并发限制、收款方无限接收、纠错撤回、极致存储清理。
 * @dev 使用 UUPS 代理模式，所有状态变量必须在 initialize 中初始化，严禁使用 constructor。
 */
contract SecureHandshakeUnlimitedInbox is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
{
    using SafeERC20 for IERC20;

    // 转账记录结构体
    struct TransferRecord {
        address sender;     // 发起人
        address receiver;   // 接收人
        address token;      // 代币地址（0x0 代表原生代币）
        uint256 amount;     // 金额
        uint256 createdAt;  // 创建时间戳
        bool isConfirmed;   // 收款方是否确认
    }

    // --- 协议配置 ---
    // uint256 public constant FEE_BPS = 10;            // 移除常量定义，改为可配置变量
    // uint256 public constant MAX_PENDING_OUTBOX = 20; // 移除常量定义，改为可配置变量
    uint256 public constant USD_UNIT = 1e18;         // 美元单位精度 (1e18 = $1)
    uint256 public constant USD_MIN_FEE = 1e16;      // 最低收费 $0.01
    uint256 public constant USD_MAX_FEE = 1e18;      // 最高收费封顶 $1.0
    uint256 public constant USD_MIN_THRESHOLD = 1e18;// 最小转账门槛 $1.0
    uint256 private _nonce;                          // 内部计数器，增强 ID 随机性

    address public treasury; // 协议财库地址，用于接收手续费

    // 存储与索引
    mapping(address => address) public tokenPriceFeeds; // Token -> Chainlink Price Feed 地址映射
    mapping(bytes32 => TransferRecord) public activeTransfers; // 交易ID -> 交易详情映射
    mapping(address => bytes32[]) private _inbox;    // 收件箱 (无长度限制，收款人索引)
    mapping(address => bytes32[]) private _outbox;   // 发件箱 (受限长度，付款人索引)
    
    // 索引映射：ID => Index (用于 O(1) 删除)
    mapping(bytes32 => uint256) private _inboxIndex; 
    mapping(bytes32 => uint256) private _outboxIndex;

    address public constant NATIVE_TOKEN = address(0); // 原生代币标识地址

    uint256 public maxPendingOutbox; // 限制付款方：防止单地址滥用合约占用存储
    uint256 public feeBps; // 基础费率 (基点: 10 = 0.1%)

    // 事件定义
    event TransferInitiated(bytes32 indexed id, address indexed sender, address indexed receiver, address token, uint256 amount);
    event TransferConfirmed(bytes32 indexed id, address indexed receiver);
    event TransferSettled(bytes32 indexed id, address indexed sender, address indexed receiver, address token, uint256 amount, string action);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // 锁定逻辑合约的初始化，防止逻辑合约被直接初始化接管
        _disableInitializers();
    }

    /**
     * @notice 初始化函数 (替代构造器)
     * @param _treasury 财库地址
     */
    function initialize(address _treasury) public initializer {
        // 初始化继承的父合约
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        require(_treasury != address(0), "Treasury address zero");
        treasury = _treasury;
        maxPendingOutbox = 20; // 默认 20 条
        feeBps = 10; // 默认 0.1%
    }

    // --- UUPS 升级安全保护 ---
    
    /**
     * @dev 版本 V2 初始化函数
     * @notice 仅在从 V1 升级到 V2 时调用一次
     * @notice 未来升级 V3 时，请添加 function reinitializeV3() reinitializer(3)
     */
    function reinitializeV2() public reinitializer(2) {
     
        if (maxPendingOutbox == 0) {
            maxPendingOutbox = 20;
        }
        if (feeBps == 0) {
            feeBps = 10;
        }
    }

    // UUPS 升级授权检查：仅拥有者可升级合约逻辑
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- 核心业务函数 ---

    /**
     * @notice 发起转账 (支持原生代币与 ERC20)
     * @dev 支持 payable，允许发送原生代币
     * @param _token 代币地址 (原生代币传 address(0))
     * @param _receiver 接收方地址
     * @param _amount 转账金额
     * @return 交易 ID
     */
    function initiate(address _token, address _receiver, uint256 _amount) public payable nonReentrant whenNotPaused returns (bytes32) {
        // 校验：如果是原生代币，附带的 msg.value 必须等于声明的 amount
        if (_token == NATIVE_TOKEN) {
            require(msg.value == _amount, "Incorrect value");
        } else {
            // 如果是 ERC20，附带的 msg.value 必须为 0
            require(msg.value == 0, "Native value sent for ERC20");
        }
        // 调用内部逻辑处理
        return _initiateInternal(_token, _receiver, _amount, _token == NATIVE_TOKEN);
    }

    /**
     * @notice 内部发起转账逻辑
     * @dev 封装了核心校验、存储更新与转账锁定逻辑
     */
    function _initiateInternal(address _token, address _receiver, uint256 _amount, bool isNative) internal returns (bytes32) {
        // 1. 校验 Token 是否在白名单（配置了预言机）
        require(tokenPriceFeeds[_token] != address(0), "Token not whitelisted");
        // 2. 校验接收方合法性（不能是零地址，不能是自己）
        require(_receiver != address(0) && _receiver != msg.sender, "Invalid receiver");

        // 3. 门槛检查：计算美元价值，防止粉尘攻击
        uint256 minAmount = _toTokenAmountForUsd(_token, USD_MIN_THRESHOLD);
        require(_amount >= minAmount, "Transfer amount below $1 minimum");

        // 4. 发件箱限制：防止单用户发起大量无效订单占用存储
        require(_outbox[msg.sender].length < maxPendingOutbox, "Your outbox is full");

        // 5. 生成唯一交易 ID (Hash: sender + receiver + timestamp + nonce)
        bytes32 id = keccak256(abi.encodePacked(
            msg.sender, 
            _receiver, 
            block.timestamp,
            _nonce++
        ));

        // 6. 资金锁定
        if (!isNative) {
            // ERC20: 从用户钱包转入合约
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }
        // Native: 已经在 initiate 中通过 payable 接收

        // 7. 写入存储记录
        activeTransfers[id] = TransferRecord({
            sender: msg.sender,
            receiver: _receiver,
            token: _token,
            amount: _amount,
            createdAt: block.timestamp,
            isConfirmed: false
            // expiresAt: Removed
        });

        // 8. 更新双向索引
        _addToInbox(_receiver, id);
        _addToOutbox(msg.sender, id);

        // 9. 抛出事件
        emit TransferInitiated(id, msg.sender, _receiver, _token, _amount);
        return id;
    }

    /**
     * @notice 支持 EIP-2612 Permit 的免授权发起转账
     * @dev 仅支持 ERC20，结合 permit 签名实现一键转账
     */
    function initiateWithPermit(
        address _token, 
        address _receiver, 
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (bytes32) {
        require(_token != NATIVE_TOKEN, "Permit not for native token");
        // 尝试调用 Token 的 permit 函数
        try IERC20Permit(_token).permit(msg.sender, address(this), _amount, _deadline, _v, _r, _s) {
            // 签名验证通过，授权成功
        } catch {
            // 如果 permit 失败或不支持，回滚交易
            revert("Permit failed");
        }
        // 授权成功后，直接调用 initiate 发起转账
        return initiate(_token, _receiver, _amount);
    }



    /**
     * @notice 收款方确认订单
     * @param _id 交易 ID
     */
    function confirmOrder(bytes32 _id) external nonReentrant whenNotPaused {
        TransferRecord storage t = activeTransfers[_id];
        require(t.receiver != address(0), "Record not found");
        require(msg.sender == t.receiver, "Only receiver can confirm");
        require(!t.isConfirmed, "Already confirmed");
        
        t.isConfirmed = true;
        emit TransferConfirmed(_id, msg.sender);
    }

    /**
     * @notice 确认放款 (发送方调用)
     * @dev 资金转移给接收方，扣除手续费
     * @param _id 交易 ID
     */
    function confirm(bytes32 _id) external nonReentrant whenNotPaused {
        TransferRecord memory t = activeTransfers[_id];
        // 1. 权限检查：必须是发起人
        require(msg.sender == t.sender, "Only sender can authorize");
        // 2. 状态检查：订单是否存在
        require(t.receiver != address(0), "Record not found");
        // 3. 确认检查：收款方必须已确认
        require(t.isConfirmed, "Receiver has not confirmed");
        
        // 4. 计算费用
        uint256 fee = _calculateFee(t.token, t.amount);
        uint256 finalAmount = t.amount - fee;

        // 5. 状态清理：从映射和数组中完全移除，释放存储 Gas
        _fullCleanup(t.sender, t.receiver, _id);

        // 6. 资金分发
        if (fee > 0) {
            if (t.token == NATIVE_TOKEN) {
                // 原生代币转给财库
                (bool success, ) = treasury.call{value: fee}("");
                require(success, "Native fee transfer failed");
            } else {
                // ERC20 转给财库
                IERC20(t.token).safeTransfer(treasury, fee);
            }
        }
        
        // 转给接收方
        if (t.token == NATIVE_TOKEN) {
            (bool success, ) = t.receiver.call{value: finalAmount}("");
            require(success, "Native transfer failed");
        } else {
            IERC20(t.token).safeTransfer(t.receiver, finalAmount);
        }

        emit TransferSettled(_id, t.sender, t.receiver, t.token, t.amount, "RELEASED");
    }

    /**
     * @notice 纠错撤回 (发送方调用)
     * @dev 资金扣除手续费后原路退回给发送方
     */
    function cancel(bytes32 _id) external nonReentrant {
        TransferRecord memory t = activeTransfers[_id];
        // 1. 权限检查
        require(msg.sender == t.sender, "Only sender can cancel");
        // 2. 存在性检查
        require(t.receiver != address(0), "Record not found");

        // 3. 计算费用（撤回也要收费）
        uint256 fee = _calculateFee(t.token, t.amount);
        uint256 refundAmount = t.amount - fee;

        // 4. 状态清理
        _fullCleanup(t.sender, t.receiver, _id);
        
        // 5. 资金分发：手续费转财库
        if (fee > 0) {
            if (t.token == NATIVE_TOKEN) {
                (bool success, ) = treasury.call{value: fee}("");
                require(success, "Native fee transfer failed");
            } else {
                IERC20(t.token).safeTransfer(treasury, fee);
            }
        }

        // 6. 退款：剩余资金退回给发送方
        _refund(t.token, t.sender, refundAmount);
        
        emit TransferSettled(_id, t.sender, t.receiver, t.token, t.amount, "CANCELLED");
    }

    // 暂停协议（紧急情况）
    function pause() external onlyOwner {
        _pause();
    }

    // 恢复协议
    function unpause() external onlyOwner {
        _unpause();
    }

    // 内部退款逻辑封装
    function _refund(address token, address refundee, uint256 amount) internal {
        if (token == NATIVE_TOKEN) {
            (bool success, ) = refundee.call{value: amount}("");
            require(success, "Native refund failed");
        } else {
            IERC20(token).safeTransfer(refundee, amount);
        }
    }

    // --- 内部逻辑与清理 ---

    /**
     * @notice 将美元金额转换为指定 Token 的数量
     * @dev 读取 Chainlink 预言机，处理精度转换
     */
    function _toTokenAmountForUsd(address _token, uint256 usdAmount) internal view returns (uint256) {
        address feed = tokenPriceFeeds[_token];
        require(feed != address(0), "Price feed not set");
        
        // 获取预言机价格
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        (uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        require(block.timestamp - updatedAt < 24 hours, "Price expired");

        // 精度处理
        // usdAmount 是 18 位精度
        // price 是 feedDecimals 精度 (通常 ETH 是 8 位)
        // Token 是 tokenDecimals 精度 (通常 USDC 是 6 位)
        
        uint8 feedDecimals = priceFeed.decimals();
        uint8 tokenDecimals;
        if (_token == NATIVE_TOKEN) {
            tokenDecimals = 18;
        } else {
            tokenDecimals = IERC20Metadata(_token).decimals();
        }
        
        // 公式：TokenAmount = (USD_18 * 10^TokenDec * 10^FeedDec) / (Price_Feed * 10^18)
        return (usdAmount * (10 ** tokenDecimals) * (10 ** feedDecimals)) / (uint256(price) * 1e18);
    }

    // 彻底清理存储：删除 mapping 记录并从收发件箱数组中移除
    function _fullCleanup(address _sender, address _receiver, bytes32 _id) internal {
        delete activeTransfers[_id]; // 删除详情
        _removeFromOutbox(_sender, _id); // O(1) 移除发件箱索引
        _removeFromInbox(_receiver, _id); // O(1) 移除收件箱索引
    }

    // --- 优化的数组操作 (O(1)) ---

    function _addToInbox(address _receiver, bytes32 _id) internal {
        // 记录新元素在数组中的索引
        _inboxIndex[_id] = _inbox[_receiver].length;
        _inbox[_receiver].push(_id);
    }

    function _addToOutbox(address _sender, bytes32 _id) internal {
        _outboxIndex[_id] = _outbox[_sender].length;
        _outbox[_sender].push(_id);
    }

    function _removeFromInbox(address _receiver, bytes32 _id) internal {
        bytes32[] storage list = _inbox[_receiver];
        uint256 index = _inboxIndex[_id];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            bytes32 lastId = list[lastIndex];
            list[index] = lastId; // 将最后一个元素移到被删除的位置
            _inboxIndex[lastId] = index; // 更新移动元素的索引
        }

        list.pop(); // 移除末尾
        delete _inboxIndex[_id]; // 删除被删除元素的索引
    }

    function _removeFromOutbox(address _sender, bytes32 _id) internal {
        bytes32[] storage list = _outbox[_sender];
        uint256 index = _outboxIndex[_id];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            bytes32 lastId = list[lastIndex];
            list[index] = lastId;
            _outboxIndex[lastId] = index;
        }

        list.pop();
        delete _outboxIndex[_id];
    }

    /**
     * @notice 计算手续费
     * @dev 规则：基础费率 0.1%，最低 $0.01，最高 $1.0
     */
    function _calculateFee(address _token, uint256 _amount) internal view returns (uint256) {
        // 1. 计算基础百分比费用
        uint256 pFee = (_amount * feeBps) / 10000;
        
        // 2. 计算动态的最低和最高费用（Token 数量）
        uint256 minFee = _toTokenAmountForUsd(_token, USD_MIN_FEE);
        uint256 maxFee = _toTokenAmountForUsd(_token, USD_MAX_FEE);

        // 3. 区间限制
        if (pFee < minFee) {
            return minFee; // 触发低保
        }
        if (pFee > maxFee) {
            return maxFee; // 触发封顶
        }
        return pFee; // 正常按比例
    }

    // --- 查询接口 ---

    // 获取用户的整个收件箱详情
    function getMyInbox(address _user) external view returns (TransferRecord[] memory) {
        bytes32[] memory ids = _inbox[_user];
        TransferRecord[] memory results = new TransferRecord[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            results[i] = activeTransfers[ids[i]];
        }
        return results;
    }

    // 获取用户的整个发件箱详情
    function getMyOutbox(address _user) external view returns (TransferRecord[] memory) {
        bytes32[] memory ids = _outbox[_user];
        TransferRecord[] memory results = new TransferRecord[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            results[i] = activeTransfers[ids[i]];
        }
        return results;
    }
    
    // 获取收件箱 ID 列表
    function getInboxIds(address _user) external view returns (bytes32[] memory) {
        return _inbox[_user];
    }

    // 获取发件箱 ID 列表
    function getOutboxIds(address _user) external view returns (bytes32[] memory) {
        return _outbox[_user];
    }

    // 获取收件箱数量
    function getInboxCount(address _user) external view returns (uint256) {
        return _inbox[_user].length;
    }

    // 获取发件箱数量
    function getOutboxCount(address _user) external view returns (uint256) {
        return _outbox[_user].length;
    }

    // 分页获取收件箱 ID
    function getInboxIdsSlice(address _user, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        bytes32[] storage list = _inbox[_user];
        uint256 len = list.length;
        if (offset >= len) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 outLen = end - offset;
        bytes32[] memory out = new bytes32[](outLen);
        for (uint256 i = 0; i < outLen; i++) {
            out[i] = list[offset + i];
        }
        return out;
    }

    // 分页获取发件箱 ID
    function getOutboxIdsSlice(address _user, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        bytes32[] storage list = _outbox[_user];
        uint256 len = list.length;
        if (offset >= len) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 outLen = end - offset;
        bytes32[] memory out = new bytes32[](outLen);
        for (uint256 i = 0; i < outLen; i++) {
            out[i] = list[offset + i];
        }
        return out;
    }

    // --- 管理接口 ---

    // 设置 Token 对应的 Chainlink 预言机地址
    function setTokenPriceFeed(address _token, address _feed) external onlyOwner {
        require(_feed != address(0), "Invalid feed address");
        tokenPriceFeeds[_token] = _feed;
    }

    // 设置财库收款地址
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        treasury = _newTreasury;
    }

    // 设置最大待处理发件箱限制
    function setMaxPendingOutbox(uint256 _limit) external onlyOwner {
        require(_limit > 0, "Limit must be > 0");
        maxPendingOutbox = _limit;
    }

    // 设置基础费率 (基点: 10 = 0.1%)
    function setFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Fee too high"); // 最高不超过 10%
        feeBps = _bps;
    }

    // 管理员批量强制清理过期订单
    // @param _ids 要检查的订单ID列表 (由于链上无法遍历所有订单，需由管理员链下筛选后传入)
    function forceExpireBatch(bytes32[] calldata _ids) external onlyOwner {
        for (uint256 i = 0; i < _ids.length; i++) {
            bytes32 id = _ids[i];
            TransferRecord memory t = activeTransfers[id];
            
            // 跳过无效或已处理的记录
            if (t.receiver == address(0)) continue;
            
            // 计算费用
            uint256 fee = _calculateFee(t.token, t.amount);
            uint256 refundAmount = t.amount - fee;

            _fullCleanup(t.sender, t.receiver, id);
            
            // 扣除手续费转给财库
            if (fee > 0) {
                if (t.token == NATIVE_TOKEN) {
                    (bool success, ) = treasury.call{value: fee}("");
                    require(success, "Native fee transfer failed");
                } else {
                    IERC20(t.token).safeTransfer(treasury, fee);
                }
            }

            _refund(t.token, t.sender, refundAmount); // 扣除手续费后退回
            emit TransferSettled(id, t.sender, t.receiver, t.token, t.amount, "EXPIRED");
        }
    }


}