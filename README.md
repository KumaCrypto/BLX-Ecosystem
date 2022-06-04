# BLX ecosystem

This project is a set of three smart contracts.

### Objective: 

#### BLXToken
is a token contract that is used in the ecosystem. <br>
See more details [HERE](./BLXToken.md)


#### BLXBank
is a contract in which users can create their own accounts, replenish balances, make transfers, the contract contains information about deposits and withdrawals of users.
There is an owner who can pause or unpause. <br>
See more details [HERE](./BLXBank.md)


#### BLXLocker
is a UUPS Upgradeable contract, an improved model of BLXBank, with the ability to transfer tokens between users in the following ways: linear vesting, unlocking funds after the specified time and transfers. <br>
See more details [HERE](./BLXLocker.md)

#### All smart contracts are verified
### Deployed in rinkeby:

  Contracts        |                             Addresses                      |
-------------------|------------------------------------------------------------|
  BLXBank          |        0x09B6Fa3ac752A20fD0C237C03D651202A8ea06BB          |                                            
  BloxifyToken     |        0x98aF19040b0B36Ef8d55E5c583A0627378803be9          |
  BLXLocker        |        0x668Fd9584430644F5e54bA74ac71e46b11bf8a55          |


#### Coverage:
File               |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-------------------|----------|----------|----------|----------|----------------|
contracts/         |      100 |      100 |      100 |      100 |                |
  BLXBank.sol      |      100 |      100 |      100 |      100 |                |
  BLXLocker.sol    |      100 |      100 |      100 |      100 |                |
  BloxifyToken.sol |      100 |      100 |      100 |      100 |                |
-------------------|----------|----------|----------|----------|----------------|
All files          |      100 |      100 |      100 |      100 |                |
