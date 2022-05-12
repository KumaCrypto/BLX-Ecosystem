// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IBloxifyToken_Upgradeable is IERC20Upgradeable {
    function mint(uint256 amount) external;
}
