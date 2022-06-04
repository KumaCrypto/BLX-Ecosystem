### Objective

Extend/upgrade a Bank contract and allow users to lock funds for other users.<br/>
Locked funds should be possible to unlock at a specific date or linearly over the given time (vesting).<br/>
Using UUPS

### User stories
Please, read the following user stories to implement:
1. As a user I want to create the lock from my bank account balance for the given address
   - I want to provide start time of the lock, end time of the lock, locked amount
2. As a user I want to get all locks that were created for me
3. As a user I want to get the amount of tokens that are unlocked in the given lock
4. As a user I want to claim the amount of tokens that is available in the given lock
5. As a user I want to get the amount of tokens that I already claimed in the given lock
6. As a user I want to get the total balance of all locked tokens from all locks that were created for me
