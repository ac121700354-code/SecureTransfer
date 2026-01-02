// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title Buffer Protocol Token (BFR)
 * @notice 协议原生代币，总量固定 1 亿，支持销毁，增发权限受控，支持治理投票 (ERC20Votes)。
 * @dev 对应白皮书 4.3.1 章节
 */
contract BufferToken is ERC20, ERC20Burnable, AccessControl, ERC20Permit, ERC20Votes {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address initialAdmin, uint256 initialSupply) ERC20("Buffer Token", "BFR") ERC20Permit("Buffer Token") {
        require(initialAdmin != address(0), "Admin zero");
        
        // 1. 根据参数铸造初始供应量
        if (initialSupply > 0) {
            _mint(initialAdmin, initialSupply);
        }

        // 2. 权限设置
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        // 注意：默认不授予 MINTER_ROLE，确保无通胀。
        // 未来若需增发，需通过治理提案授予时间锁合约 MINTER_ROLE。
    }

    /**
     * @notice 增发接口
     * @dev 仅拥有 MINTER_ROLE 的地址（如 TimeLock 治理合约）可调用
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
