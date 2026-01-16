// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRouter {
    mapping(address => bool) public shouldFail;

    function setShouldFail(address token, bool fail) external {
        shouldFail[token] = fail;
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        // Path: [InputToken, ..., OutputToken]
        address inputToken = path[0];
        address outputToken = path[path.length - 1];

        if (shouldFail[inputToken]) {
            revert("Token Swap Failed");
        }

        // Mock Logic:
        // 1. Receive input tokens
        IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);
        
        // 2. Send output tokens (Assume 1:1 for simplicity)
        // We need to ensure MockRouter has outputToken balance.
        IERC20(outputToken).transfer(to, amountIn);
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable {
        address outputToken = path[path.length - 1];

        // Send output tokens (Assume 1 ETH = 1 Token for simplicity, or just transfer amountIn)
        // Note: msg.value is amountIn
        IERC20(outputToken).transfer(to, msg.value);
    }
}
