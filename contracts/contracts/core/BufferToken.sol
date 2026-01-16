// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BufferToken is ERC20, ERC20Burnable, AccessControl, ERC20Permit, ERC20Votes, ERC20Pausable, ReentrancyGuard {
    // 使用 constant 变量替代 struct constant，因为 Solidity 暂不支持 struct constant
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_SUPPLY = 1e9 * 1e18; // 10 亿代币（18 小数位）

    mapping(address => bool) public isTrustedDelegatee;

    event Mint(address indexed to, uint256 amount, uint256 totalSupply);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event DelegateeStatusChanged(address indexed delegatee, bool status);

    constructor(address initialAdmin, address timelock, uint256 initialSupply) 
        ERC20("Handshk Token", "HK") 
        ERC20Permit("Handshk Token") 
    {
        require(initialAdmin != address(0), "Admin zero");
        require(timelock != address(0), "Timelock zero");
        require(initialSupply <= MAX_SUPPLY, "Exceeds max supply");

        if (initialSupply > 0) {
            _mint(initialAdmin, initialSupply);
        }

        // 权限设置：管理员角色授予时间锁，销毁角色保留给管理员
        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        _grantRole(MINTER_ROLE, timelock); // 增发权限交由时间锁管理
        _grantRole(PAUSER_ROLE, timelock); // 暂停权限交由时间锁管理
    
    }

    // 增发接口（仅时间锁可调用）
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) nonReentrant {
        require(totalSupply() + amount <= MAX_SUPPLY && totalSupply() + amount >= totalSupply(), "Invalid amount");
        _mint(to, amount);
        // ERC20 标准中，_mint 已经会自动发射 Transfer(address(0), to, amount) 事件。
        // OpenZeppelin 的 _mint 实现如下：
        // emit Transfer(address(0), account, value);
        // 因此无需手动发射 Transfer 事件，否则会造成重复。
        emit Mint(to, amount, totalSupply());
    }

    /**
     * @notice 设置委托代理人的白名单状态
     * @dev 必须由 TimeLock 合约调用以防止前端运行攻击（Front-running）。
     *      管理员若能立即修改白名单，可拒绝用户的合法委托。
     */
    function setDelegateeStatus(address delegatee, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isTrustedDelegatee[delegatee] = status;
        emit DelegateeStatusChanged(delegatee, status);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // 安全的 Permit 实现
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override(ERC20Permit) {
        // 移除 spender 检查以符合 ERC20Permit 标准
        // require(spender == address(this), "Invalid spender");
        // 当前实现已正确，无需修改（OpenZeppelin 的 ERC20Permit 内部已验证签名）
        super.permit(owner, spender, value, deadline, v, r, s);
    }

    // 安全的委托投票
    function delegate(address delegatee) public override {
        // 合并检查以节省 Gas：如果 delegatee 为 0，isTrustedDelegatee 读取会被跳过（但此处必须检查 != 0）
        // 更重要的是，将两个 require 合并可以减少一次 JUMP 指令。
        require(delegatee != address(0) && isTrustedDelegatee[delegatee], "Invalid or untrusted delegatee");
        _delegate(msg.sender, delegatee); // 优化：直接调用 ERC20Votes 的内部函数，避免 super.delegate() 带来的额外开销
    }







    // Gas 优化：直接返回非ces
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // 覆写 _update 以支持投票和暂停
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes, ERC20Pausable) {
        super._update(from, to, value);
    }

    // 覆写 burn 以添加 nonReentrant
    function burn(uint256 value) public override nonReentrant {
        super.burn(value);
    }

    // 覆写 burnFrom 以添加 nonReentrant
    function burnFrom(address account, uint256 value) public override nonReentrant {
        super.burnFrom(account, value);
    }


}
