// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBloxifyToken is IERC20 {
    function mint(uint256 amount) external;
}
