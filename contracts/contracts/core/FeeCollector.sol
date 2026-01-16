// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// 简单的 Chainlink 接口
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

// 简单的 Uniswap/Pancake Router 接口
interface IUniswapV2Router02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
}

// 必须包含 Burn 接口
interface IBurnable {
    function burn(uint256 amount) external;
}

/**
 * @title FeeCollector (Protocol Treasury)
 * @notice 负责收集协议手续费，并执行回购销毁逻辑
 * @dev 对应白皮书 4.3.2 章节：手续费回购与销毁
 */
contract FeeCollector is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- 配置 ---
    address public immutable bufferToken;       // 协议代币 STP
    address public immutable uniRouter;         // DEX 路由地址 (Uniswap/Pancake)
    address public immutable weth;              // WETH/WBNB 地址
    
    // 销毁地址
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // DAO 金库地址
    address public daoTreasury;
    // 质押/社区激励地址
    address public stakingTreasury;

    // 触发回购的最小美元价值 ($10,000)
    uint256 public buybackThresholdUsd = 10_000 * 1e18; 
    
    // 分配比例 (基点 10000 = 100%)
    uint256 public burnRatioBps = 5000;      // 50% 销毁
    uint256 public stakingRatioBps = 3000;   // 30% 质押/激励
    // treasuryRatio 由 10000 - burnRatioBps - stakingRatioBps 计算得出 (20%)
    
    // 回购功能开关
    bool public buybackEnabled = false;

    // 代币 -> 预言机 映射
    mapping(address => address) public priceFeeds;
    mapping(address => bool) public keepers;
    mapping(address => bool) public supportedTokens; // 白名单：仅允许受支持的代币参与回购
    mapping(address => address[]) public swapPaths;  // 自定义路由路径

    // 事件
    event KeeperUpdated(address indexed keeper, bool active);
    event RatiosUpdated(uint256 burnRatio, uint256 stakingRatio, uint256 treasuryRatio);
    event BuybackExecuted(address indexed token, uint256 amountIn, uint256 stpAmountOut, address[] path);
    event BuybackFailed(address indexed token, uint256 amountIn, string reason);
    event Burned(uint256 amount);
    event DaoFunded(uint256 amount);
    event StakingFunded(uint256 amount);
    event ThresholdUpdated(uint256 newThreshold);
    event BuybackEnabledUpdated(bool enabled);
    event DaoTreasuryUpdated(address newTreasury);
    event StakingTreasuryUpdated(address newTreasury);
    event SupportedTokenUpdated(address token, bool supported);
    event SwapPathUpdated(address token, address[] path);

    constructor(address _bufferToken, address _uniRouter, address _weth, address _daoTreasury, address _stakingTreasury) Ownable(msg.sender) {
        require(_bufferToken != address(0), "Token zero");
        require(_uniRouter != address(0), "Router zero");
        require(_daoTreasury != address(0), "Treasury zero");
        // stakingTreasury can be zero initially if not deployed yet, but better to require it or set later
        // Given we will deploy it, let's allow setting it later if needed, but for now constructor param is good.
        // Actually, to avoid circular dependency deployment issues if Staking depends on FeeCollector (unlikely), 
        // let's allow it to be updated. But let's add it to constructor for completeness if available.
        // Wait, existing deployment scripts might break if I change constructor signature.
        // It's better to keep constructor compatible or update deployment scripts.
        // I will update deployment scripts too.
        
        bufferToken = _bufferToken;
        uniRouter = _uniRouter;
        weth = _weth;
        daoTreasury = _daoTreasury;
        stakingTreasury = _stakingTreasury;
    }

    // 允许接收原生代币 (BNB/ETH)
    receive() external payable {}

    // --- 管理配置 ---

    function setKeeper(address _keeper, bool _active) external onlyOwner {
        keepers[_keeper] = _active;
        emit KeeperUpdated(_keeper, _active);
    }

    function setRatios(uint256 _burnRatio, uint256 _stakingRatio) external onlyOwner {
        require(_burnRatio + _stakingRatio <= 10000, "Ratios too high");
        burnRatioBps = _burnRatio;
        stakingRatioBps = _stakingRatio;
        emit RatiosUpdated(_burnRatio, _stakingRatio, 10000 - _burnRatio - _stakingRatio);
    }
    
    function setDaoTreasury(address _daoTreasury) external onlyOwner {
        require(_daoTreasury != address(0), "Zero address");
        daoTreasury = _daoTreasury;
        emit DaoTreasuryUpdated(_daoTreasury);
    }

    function setStakingTreasury(address _stakingTreasury) external onlyOwner {
        require(_stakingTreasury != address(0), "Zero address");
        stakingTreasury = _stakingTreasury;
        emit StakingTreasuryUpdated(_stakingTreasury);
    }

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
        // 自动将有预言机的代币加入白名单
        if (feed != address(0)) {
            supportedTokens[token] = true;
            emit SupportedTokenUpdated(token, true);
        }
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit SupportedTokenUpdated(token, supported);
    }

    function setSwapPath(address token, address[] calldata path) external onlyOwner {
        require(path.length >= 2, "Invalid path");
        require(path[0] == token, "Path start mismatch");
        require(path[path.length - 1] == bufferToken, "Path end mismatch");
        swapPaths[token] = path;
        emit SwapPathUpdated(token, path);
    }

    function setBuybackThreshold(uint256 _newThreshold) external onlyOwner {
        buybackThresholdUsd = _newThreshold;
        emit ThresholdUpdated(_newThreshold);
    }

    function setBuybackEnabled(bool _enabled) external onlyOwner {
        buybackEnabled = _enabled;
        emit BuybackEnabledUpdated(_enabled);
    }

    // --- 核心逻辑 ---

    /**
     * @notice 检查当前持有的指定代币总价值是否达到回购门槛
     * @param tokens 要结算的代币地址列表 (不包含原生代币)
     * @param includeNative 是否包含当前持有的原生代币余额
     * @return totalUsdValue 总美元价值 (18位精度)
     * @return isTriggerable 是否达到触发条件
     */
    function checkUpside(address[] calldata tokens, bool includeNative) public view returns (uint256 totalUsdValue, bool isTriggerable) {
        // 1. 计算 Native Token 价值
        if (includeNative && address(this).balance > 0) {
            totalUsdValue += _getUsdValue(address(0), address(this).balance);
        }

        // 2. 计算 ERC20 Token 价值 (优化：只计算有余额且受支持的)
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            // 只检查受支持的代币
            if (!supportedTokens[token]) continue;
            
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal > 0) {
                totalUsdValue += _getUsdValue(token, bal);
            }
        }

        return (totalUsdValue, totalUsdValue >= buybackThresholdUsd);
    }

    /**
     * @notice 执行回购与销毁
     * @dev 任何人均可调用，只要满足条件
     * @param tokens 要处理的代币列表
     * @param minBfrOuts 每个代币对应的最小 STP 输出量 (滑点保护)
     * @param minBfrFromNative 原生代币对应的最小 STP 输出量
     * @param includeNative 是否处理原生代币
     */
    function executeBuybackAndBurn(
        address[] calldata tokens, 
        uint256[] calldata minBfrOuts,
        uint256 minBfrFromNative,
        bool includeNative
    ) external nonReentrant {
        require(buybackEnabled, "Buyback disabled");
        require(msg.sender == owner() || keepers[msg.sender], "Not keeper");
        require(tokens.length == minBfrOuts.length, "Arrays length mismatch");

        // 1. 验证总价值门槛
        (, bool triggerable) = checkUpside(tokens, includeNative);
        require(triggerable, "Threshold not met");

        uint256 totalBfrBought = 0;

        // 2. 处理原生代币 (BNB/ETH) -> BFR
        if (includeNative) {
            uint256 ethBal = address(this).balance;
            if (ethBal > 0) {
                try this.swapEthForBfr(ethBal, minBfrFromNative) returns (uint256 bought) {
                    totalBfrBought += bought;
                } catch {
                     emit BuybackFailed(address(0), ethBal, "Native Swap Failed");
                }
            }
        }

        // 3. 处理 ERC20 -> BFR (使用 try/catch 防止单个失败阻塞整体)
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (!supportedTokens[token]) continue;

            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal > 0) {
                try this.swapTokenForBfr(token, bal, minBfrOuts[i]) returns (uint256 bought) {
                    totalBfrBought += bought;
                } catch {
                    emit BuybackFailed(token, bal, "Token Swap Failed");
                }
            }
        }

        // 4. 分配 BFR (根据配置比例)
        require(totalBfrBought > 0, "No BFR bought");
        
        uint256 burnAmount = (totalBfrBought * burnRatioBps) / 10000;
        uint256 stakingAmount = (totalBfrBought * stakingRatioBps) / 10000;
        uint256 daoAmount = totalBfrBought - burnAmount - stakingAmount; // 剩余归 DAO

        // 执行销毁
        if (burnAmount > 0) {
            _burnBfr(burnAmount);
        }
        
        // 30% 转入 Staking/Rewards
        if (stakingAmount > 0 && stakingTreasury != address(0)) {
            IERC20(bufferToken).safeTransfer(stakingTreasury, stakingAmount);
            emit StakingFunded(stakingAmount);
        }

        // 20% 转入 DAO
        if (daoAmount > 0) {
            IERC20(bufferToken).safeTransfer(daoTreasury, daoAmount);
            emit DaoFunded(daoAmount);
        }
    }

    // --- Public Swap Functions (exposed for try/catch) ---
    // 必须是 public 才能被 this.call 调用，加上 onlySelf 保护
    
    modifier onlySelf() {
        require(msg.sender == address(this), "Internal call only");
        _;
    }

    function swapEthForBfr(uint256 amountIn, uint256 minOut) external onlySelf returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = bufferToken;

        uint256 beforeBal = IERC20(bufferToken).balanceOf(address(this));

        IUniswapV2Router02(uniRouter).swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountIn}(
            minOut,
            path,
            address(this),
            block.timestamp + 300 // 5 min deadline
        );

        uint256 bought = IERC20(bufferToken).balanceOf(address(this)) - beforeBal;
        emit BuybackExecuted(address(0), amountIn, bought, path);
        return bought;
    }

    function swapTokenForBfr(address token, uint256 amountIn, uint256 minOut) external onlySelf returns (uint256) {
        IERC20(token).forceApprove(uniRouter, amountIn);

        address[] memory path = swapPaths[token];
        if (path.length == 0) {
            // 默认路径: Token -> WETH -> BufferToken
            path = new address[](3);
            path[0] = token;
            path[1] = weth;
            path[2] = bufferToken;
        }

        uint256 beforeBal = IERC20(bufferToken).balanceOf(address(this));

        IUniswapV2Router02(uniRouter).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            minOut,
            path,
            address(this),
            block.timestamp + 300 // 5 min deadline
        );

        uint256 bought = IERC20(bufferToken).balanceOf(address(this)) - beforeBal;
        emit BuybackExecuted(token, amountIn, bought, path);
        return bought;
    }

    // --- 内部辅助 ---

    function _burnBfr(uint256 amount) internal {
        try IBurnable(bufferToken).burn(amount) {
            // Burn 成功
        } catch {
            IERC20(bufferToken).safeTransfer(DEAD_ADDRESS, amount);
        }
        emit Burned(amount);
    }

    function _getUsdValue(address token, uint256 amount) internal view returns (uint256) {
        address feed = (token == address(0)) ? priceFeeds[weth] : priceFeeds[token];
        if (feed == address(0)) return 0;

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        uint8 tokenDecimals;
        
        if (token == address(0)) {
            tokenDecimals = 18;
        } else {
            try IERC20Metadata(token).decimals() returns (uint8 d) {
                tokenDecimals = d;
            } catch {
                tokenDecimals = 18; // Default fallback
            }
        }

        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();
        
        if (price <= 0) return 0;
        if (updatedAt == 0 || block.timestamp - updatedAt > 24 hours) return 0; 
        
        // Calculation: amount * price / (10^feedDecimals) / (10^tokenDecimals) * 1e18
        // Using Math.mulDiv for safety
        uint256 value = Math.mulDiv(
            amount * uint256(price), 
            1e18, 
            (10 ** feedDecimals) * (10 ** tokenDecimals)
        );
        
        return value;
    }
    
    // 紧急提取
    function emergencyWithdraw(address token, address to) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(address(this).balance);
        } else {
            IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
        }
    }
}
