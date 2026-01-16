// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title IBufferProxy
/// @notice 代理合约标准接口定义
interface IBufferProxy {
    /// @notice 返回当前管理员地址
    function admin() external view returns (address);
    
    /// @notice 返回当前实现合约地址
    function implementation() external view returns (address);
    
    /// @notice 升级实现合约
    function upgradeTo(address newImplementation) external;

    /// @notice 更改管理员地址
    function changeAdmin(address newAdmin) external;

    /// @notice 升级并调用初始化函数
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable;
}

/// @title BufferProxy - UUPS 可升级代理合约
/// @notice 使用 UUPS 模式实现可升级性，逻辑合约负责升级控制
/// @dev 继承自 OpenZeppelin 的 ERC1967Proxy
/// @custom:security-contact security@buffer.finance
contract BufferProxy is ERC1967Proxy {
    
    /// @dev 合约版本号，用于追踪部署版本
    string private constant _VERSION = "1.0.0";

    /// @notice 初始化代理合约
    /// @dev 构造函数添加了参数验证
    /// @param implementation 逻辑合约地址 (必须包含 UUPS 升级逻辑)
    /// @param _data 初始化调用数据 (例如: abi.encodeWithSignature("initialize(...)"))
    constructor(
        address implementation,
        bytes memory _data
    ) payable ERC1967Proxy(implementation, _data) {
        // 🔴 严重风险修复 2: 构造函数参数验证
        require(implementation != address(0), "Implementation is zero address");
        require(implementation.code.length > 0, "Implementation not contract"); // 确保是合约地址
        
        // 🔴 严重风险修复 2: 验证 _data 有效性
        require(_data.length > 0, "Empty init data");
    }
}
