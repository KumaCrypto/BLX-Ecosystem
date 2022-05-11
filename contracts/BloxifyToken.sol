// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BloxifyToken is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }

    // The point in the task reads:
    // "As a user I want to be able to mint any number of tokens for myself",
    // also "User can not mint tokens for others"
    // Therefore , it was decided to change the function to the following form:
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
