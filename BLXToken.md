### Objective

Create ERC20 token contract with `BLX` symbol, `Bloxify Token` name, and `18` decimals.
Make sure to cover all User Stories below and test them.

### User stories
Please, read the following user stories to implement:
1. As a user I want to get meta-information about the token - name, symbol, total supply, and decimals
    - methods: `name()`, `symbol()`, `totalSupply()`, `decimals()`
2. As a user I want to get information about the balance of a given address
    - method: `balanceOf(address)`
3. As a user I want to be able to mint any number of tokens for myself
    - method: `mint(uint256)`
4. As a user I want to be able to transfer any number of currently owned tokens to any address
    - method: `transfer(address, uint256)`
5. As a user I want to be able to approve any other address to use the given number of my tokens
    - method: `approve(address, uint256)`
6. As a user I want to get information about the allowed number of tokens of one address that can be used by another address
    - method: `allowance(address, address)`
7. As a user that is approved to use other's tokens, I want to be able to transfer the allowed number
   of tokens from the owner to any other address
    - method: `transferFrom(address, address, uint256)`

### Additional rules
- User can not mint tokens for others
- User can not transfer other's tokens without allowance
- Any change of the contract state (balances, allowances, supply) should be fallowed by emited Events
  - eg. `Transfer(address, uint256)`, `Mint(address, uint256)`, `Approve(address, address, uint256)`
- Meta-information should be set in the constructor.
- Token contract should implement IERC20 interface
