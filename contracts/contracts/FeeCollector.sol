// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

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
    address public bufferToken;       // 协议代币 STP
    address public uniRouter;         // DEX 路由地址 (Uniswap/Pancake)
    address public weth;              // WETH/WBNB 地址
    
    // 销毁地址 (白皮书提到 0x...dEaD，但我们优先尝试调用 burn)
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    // 触发回购的最小美元价值 ($10,000)
    uint256 public buybackThresholdUsd = 10_000 * 1e18; 
    
    // 代币 -> 预言机 映射
    mapping(address => address) public priceFeeds;

    // 事件
    event BuybackExecuted(address indexed token, uint256 amountIn, uint256 stpAmountOut);
    event Burned(uint256 amount);
    event ThresholdUpdated(uint256 newThreshold);

    constructor(address _bufferToken, address _uniRouter, address _weth) Ownable(msg.sender) {
        require(_bufferToken != address(0), "Token zero");
        require(_uniRouter != address(0), "Router zero");
        bufferToken = _bufferToken;
        uniRouter = _uniRouter;
        weth = _weth;
    }

    // 允许接收原生代币 (BNB/ETH)
    receive() external payable {}

    // --- 管理配置 ---

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
    }

    function setBuybackThreshold(uint256 _newThreshold) external onlyOwner {
        buybackThresholdUsd = _newThreshold;
        emit ThresholdUpdated(_newThreshold);
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

        // 2. 计算 ERC20 Token 价值
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
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
     * @param minBfrOuts 每个代币交换 BFR 的最小输出量 (滑点保护)
     * @param includeNative 是否处理原生代币
     */
    function executeBuybackAndBurn(
        address[] calldata tokens, 
        uint256[] calldata minBfrOuts,
        bool includeNative
    ) external nonReentrant {
        require(tokens.length == minBfrOuts.length, "Arrays length mismatch");

        // 1. 验证总价值门槛
        (, bool triggerable) = checkUpside(tokens, includeNative);
        require(triggerable, "Threshold not met");

        uint256 totalBfrBought = 0;

        // 2. 处理原生代币 (BNB/ETH) -> BFR
        if (includeNative) {
            uint256 ethBal = address(this).balance;
            if (ethBal > 0) {
                totalBfrBought += _swapEthForBfr(ethBal, 0); // 注意：生产环境应通过预言机计算 minOut 或由参数传入
            }
        }

        // 3. 处理 ERC20 -> BFR
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal > 0) {
                totalBfrBought += _swapTokenForBfr(token, bal, minBfrOuts[i]);
            }
        }

        // 4. 销毁 BFR
        require(totalBfrBought > 0, "No BFR bought");
        _burnBfr(totalBfrBought);
    }

    // --- 内部逻辑 ---

    function _swapEthForBfr(uint256 amountIn, uint256 minOut) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = bufferToken;

        // 记录初始余额
        uint256 beforeBal = IERC20(bufferToken).balanceOf(address(this));

        IUniswapV2Router02(uniRouter).swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountIn}(
            minOut,
            path,
            address(this),
            block.timestamp
        );

        uint256 bought = IERC20(bufferToken).balanceOf(address(this)) - beforeBal;
        emit BuybackExecuted(address(0), amountIn, bought);
        return bought;
    }

    function _swapTokenForBfr(address token, uint256 amountIn, uint256 minOut) internal returns (uint256) {
        // OpenZeppelin v5 推荐使用 forceApprove 替代 safeApprove(0) + safeApprove(amount)
        IERC20(token).forceApprove(uniRouter, amountIn);

        address[] memory path = new address[](3);
        path[0] = token;
        path[1] = weth; // 通常通过 WETH/WBNB 路由：Token -> WBNB -> BFR
        path[2] = bufferToken;

        // 如果直接有 Token-BFR 交易对，可以优化路径，这里默认走中间路由

        uint256 beforeBal = IERC20(bufferToken).balanceOf(address(this));

        IUniswapV2Router02(uniRouter).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            minOut,
            path,
            address(this),
            block.timestamp
        );

        uint256 bought = IERC20(bufferToken).balanceOf(address(this)) - beforeBal;
        emit BuybackExecuted(token, amountIn, bought);
        return bought;
    }

    function _burnBfr(uint256 amount) internal {
        // 尝试调用 burn
        try IBurnable(bufferToken).burn(amount) {
            // Burn 成功
        } catch {
            // 如果 Token 不支持 burn，则转入死穴
            IERC20(bufferToken).safeTransfer(DEAD_ADDRESS, amount);
        }
        emit Burned(amount);
    }

    function _getUsdValue(address token, uint256 amount) internal view returns (uint256) {
        address feed = (token == address(0)) ? priceFeeds[weth] : priceFeeds[token];
        // 如果没有预言机，暂时按 0 价值计算，防止阻塞
        if (feed == address(0)) return 0;

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        uint8 tokenDecimals;
        if (token == address(0)) {
            tokenDecimals = 18;
        } else {
            // 尝试获取 decimals，如果失败默认为 18
            try IERC20Metadata(token).decimals() returns (uint8 d) {
                tokenDecimals = d;
            } catch {
                tokenDecimals = 18;
            }
        }

        // Value = Amount * Price
        // 统一转为 18 位精度 USD
        
        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();
        
        // Stale Price Check
        if (price <= 0) return 0;
        if (updatedAt == 0 || block.timestamp - updatedAt > 24 hours) return 0; // Stale price treated as 0 value
        
        return (amount * uint256(price) * 1e18) / (10 ** feedDecimals) / (10 ** tokenDecimals); 
    }
    
    // 紧急提取 (防止资产卡死)
    function emergencyWithdraw(address token, address to) external onlyOwner {
        if (token == address(0)) {
            payable(to).transfer(address(this).balance);
        } else {
            IERC20(token).safeTransfer(to, IERC20(token).balanceOf(address(this)));
        }
    }
}
