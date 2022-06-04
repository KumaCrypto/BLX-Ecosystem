### Objective

Create a Bank contract where users create their accounts and can store `BLX` token <br/>
The bank should store information about the number of user accounts and global BLX balance. <br/>
It should be possible to get public information about any user account - date of creation, balance, and number of transactions (deposits and withdrawals). <br/>
The bank should have the owner account that is able to pause and unpause deposits

### User stories
Please, read the following user stories to implement:
1. As a user I want to get a global bank balance of `BLX` token
2. As a user I want to get the address of the owner of the bank
3. As a user I want to be able to deposit any number of `BLX` tokens to my bank account
4. As a user I want to be able to withdraw any number of `BLX` tokens that is available in my account
5. As a user I want to be able to check that the global bank balance of `BLX` token changes after the deposit or withdrawal
6. As a user I want to get information about my account - date of creation, balance, number of transaction if account is active
7. As a user I want to be able to deactivate my account
8. As a user I want to be able to transfer funds from my bank account to another existing bank account
9. As a user I want to be unable to transfer funds from my bank account to an inactive bank account
10. As an owner I want to be able to pause and unpause deposits to the bank
11. As a user I want to be unable to deposit tokens when deposits are paused

### Additional rules
- User can only withdraw tokens from his bank account
- User can only transfer tokens from his bank account
- For Owner and Pausable features use Ownable and Pausable contracts from OpenZeppelin (more in materials above)
