// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleDistributor {
    address public owner;
    IERC20 public token;
    bytes32 public merkleRoot;

    mapping(uint256 => uint256) private claimedBitMap;

    event Claimed(uint256 index, address account, uint256 amount);
    event MerkleRootUpdated(bytes32 previousRoot, bytes32 newRoot);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address token_, bytes32 merkleRoot_, address owner_) {
        require(token_ != address(0), "Token zero");
        token = IERC20(token_);
        merkleRoot = merkleRoot_;
        owner = owner_ == address(0) ? msg.sender : owner_;
        emit OwnershipTransferred(address(0), owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        bytes32 prev = merkleRoot;
        merkleRoot = newRoot;
        emit MerkleRootUpdated(prev, newRoot);
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 word = claimedBitMap[wordIndex];
        uint256 mask = (1 << bitIndex);
        return word & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitMap[wordIndex] = claimedBitMap[wordIndex] | (1 << bitIndex);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external {
        require(!isClaimed(index), "Already claimed");
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(_verify(merkleProof, merkleRoot, node), "Invalid proof");
        _setClaimed(index);
        require(token.transfer(account, amount), "Transfer failed");
        emit Claimed(index, account, amount);
    }

    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    /**
     * @notice 提取合约中剩余的代币 (用于回收未领取的空投)
     * @param tokenAddress 要提取的代币地址 (address(0) 为原生代币)
     * @param to 接收地址
     * @param amount 提取金额
     */
    function withdraw(address tokenAddress, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        if (tokenAddress == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Native transfer failed");
        } else {
            require(IERC20(tokenAddress).transfer(to, amount), "ERC20 transfer failed");
        }
    }
}

