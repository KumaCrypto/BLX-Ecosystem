// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./Interfaces/IBloxifyToken_Upgradeable.sol";

// Error list:
//     ERROR #1 = The current pause state does not match the requested one;
//     ERROR #2 = Expectations on account activity status - do not match;
//     ERROR #3 = The requested value is greater than your balance;
//     ERROR #4 = Error at the specified time.
//     ERROR #5 = This lock does not exist.
//     ERROR #6 = You cannot сlaim 0 tokens.
//     ERROR #7 = Unlock time is not reached
//     ERROR #8 = The lock value must be greater than 0 + and less then 1.
//     ERROR #9 = All available funds have been collected.

/** @title
    An updatable bank in which users can store tokens,
    as well as block tokens for other users, or with linear unblocking.
*/
/// @author Vladimir Kumalagov.
contract BLXLocker is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20Upgradeable for IBloxifyToken_Upgradeable;

    /// @notice BloxifyToken contract.
    IBloxifyToken_Upgradeable public bloxify;

    ///@notice The total amount of funds stored by users at the moment in the bank.
    uint256 public s_bankBalance;

    /// @notice The current number of active users.
    /// @dev Made as uint248 in order for the next variable of type bool to fit into the same slot.
    uint248 public s_numberOfUser;

    /** @notice What is the current state of the contract: on pause or not.
    If the contract is on pause, some functions temporarily do not work. */
    bool public s_isPaused;

    /** @notice
        The structure of the bank account, each includes:
        balance,
        balance of all locks for this user,
        time of creation,
        lock amount for this user,
        number of operations performed,
        account status
    */
    /** @dev createdAt + lockersAmount + transactionsCount + isActive = occupy only one slot
     */

    struct BankAccount {
        uint256 balance;
        uint256 lockedBalance;
        uint64 createdAt;
        uint88 lockersAmount;
        uint96 transactionsCount;
        bool isActive;
    }

    /** @notice
    The structure of lock funds is:
        Address of the sender of funds
        Start time
        Vesting it or one-time blocking.
        Lock end Time
        The amount
        The amount of funds taken 
    */
    /** @dev
        The sender's address is 20 bytes,
        the start time and isVesting occupy the remaining space in the slot.
    */
    struct Lock {
        address sender;
        uint88 startTime;
        bool isVesting;
        uint256 endTime;
        uint256 amount;
        uint256 claimed;
    }

    /// @notice Mapping the user's address with his personal account.
    mapping(address => BankAccount) public s_bankAccounts;

    /// @notice Mapping that indicates a specific lock for the user.
    mapping(address => mapping(uint256 => Lock)) public s_locks;

    /// @param _bloxify - is address of the bloxify token contract.
    function initialaze(IBloxifyToken_Upgradeable _bloxify) public initializer {
        bloxify = _bloxify;
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /// @notice An event that signals a change in the pause state in the contract.
    /// @param modifying - The address that changed the pause status of the contract.
    /// @param newStatus - Boolean values of the new status. True - paused, false - not paused.
    event PauseChanged(address indexed modifying, bool newStatus);

    /// @notice Creating a bank account.
    /// @param creator - The creator address.
    event AccountCreated(address indexed creator);

    /// @notice Replenishment of the bank account.
    /// @param client - the address that was deposited.
    /// @param amount - the amount for which the deposit was made.
    event Deposited(address indexed client, uint256 amount);

    /// @notice Withdrawal of funds from a bank account.
    /// @param client - the address from which the funds were withdrawn.
    /// @param amount - Withdrawal amount.
    event Withdrawn(address indexed client, uint256 amount);

    /// @notice Event during account deactivation.
    /// @param client - The address of the deactivated account.
    event AccountDeactivated(address indexed client);

    /// @notice An event when making a transfer inside the banking system.
    /// @param sender - The address from which the transfer is made.
    /// @param receiver - The address to which the transfer is being made.
    /// @param amount - Transfer amount.
    event Transfered(
        address indexed sender,
        address indexed receiver,
        uint256 amount
    );

    /// @notice The event emitted when funds are blocked.
    /// @param sender - Who blocked the funds.
    /// @param receiver - The recipient of the blocked funds.
    /// @param amount - The recipient of the blocked funds.
    /// @param isVesting - Whether the blocking is vesting.
    event Locked(
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        bool isVesting
    );

    /// @notice Is emitted when collecting funds from lock.
    /// @param receiver - The address of the user who collected the funds.
    /// @param lockId - The id of the lock from which the funds were claimed.
    /// @param amount - Amount of funds claimed.
    event Claimed(address indexed receiver, uint256 lockId, uint256 amount);

    /// @notice Checks the expected pause state with the pause state in the contract.
    /// @param expectedStatus - Expected status in the contract
    modifier checkPause(bool expectedStatus) {
        require(expectedStatus == s_isPaused, "BLXBank: ERROR #1");
        _;
    }

    /// @notice Checks the requirements related to the status of the user account.
    /// @param account - The address whose status needs to be checked.
    /// @param expectation - Expected status of the user account.
    modifier isActive(address account, bool expectation) {
        require(
            s_bankAccounts[account].isActive == expectation,
            "BLXBank: ERROR #2"
        );
        _;
    }

    /** @notice Creates a user account. 
        Requirement - the account was not created before,
        or was created - but later deleted. */
    function createBankAccount() external isActive(msg.sender, false) {
        s_bankAccounts[msg.sender] = BankAccount(
            0,
            0,
            uint64(block.timestamp),
            0,
            0,
            true
        );
        unchecked {
            ++s_numberOfUser;
        }
        emit AccountCreated(msg.sender);
    }

    /** @notice Entering tokens into the bank account balance. 
    Requirement:
        - the contract should not be on pause
        - the caller's account must be active.
    */
    /** @dev All calculations are placed in a unchecked block, 
             since tokens are limited by the number of totalSupply,
             and the number of transactions is unlikely to reach uint248
    */
    /// @param amount -The number of tokens to be deposited.
    function deposit(uint256 amount)
        external
        checkPause(false)
        isActive(msg.sender, true)
    {
        bloxify.safeTransferFrom(msg.sender, address(this), amount);

        BankAccount storage currentUser = s_bankAccounts[msg.sender];

        unchecked {
            currentUser.balance = currentUser.balance + amount;
            ++currentUser.transactionsCount;

            s_bankBalance = s_bankBalance + amount;
        }

        emit Deposited(msg.sender, amount);
    }

    /** @notice Transfers the user's tokens from the bank account to his account.
    The requirement is that the bank's contract should not be on pause.*/

    /** @dev unchecked - The balance is verified by the requirement,
        and the number of transactions is unlikely to reach the number of uint248
    */
    /// @param amount - Number of tokens to be withdrawn, must be less than or equal to the balance.
    function withdraw(uint256 amount) public checkPause(false) {
        BankAccount storage currentUser = s_bankAccounts[msg.sender];

        require(currentUser.balance >= amount, "BLXBank: ERROR #3");

        unchecked {
            currentUser.balance = currentUser.balance - amount;
            ++currentUser.transactionsCount;

            s_bankBalance = s_bankBalance - amount;
        }

        bloxify.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /** @notice Deactivates the account of the calling user
        if the balance was non-zero transfers them to the user.
        Requirement the account must be activated before that.
    */
    /// @dev We delete it through "delete", to free up storage and return gas for the call.
    function deactivateAccount() external isActive(msg.sender, true) {
        if (s_bankAccounts[msg.sender].balance > 0) {
            withdraw(s_bankAccounts[msg.sender].balance);
        }

        delete s_bankAccounts[msg.sender];

        unchecked {
            --s_numberOfUser;
        }
        emit AccountDeactivated(msg.sender);
    }

    /** @notice Transfer between two bank accounts.
    Requirements:
        Both accounts must be active,
        the sender must have enough funds.
        The bank's contract should not be on pause.*/
    /// @param to - Recipient's address.
    /// @param amount - Number of tokens to be transferred.
    /** @dev We can add a check that the recipient's address is not equal to the sender's address,
        but since we do not have functionality that involves the number of user transactions,
        this does not affect anything. 
    */
    function transfer(address to, uint256 amount)
        external
        checkPause(false)
        isActive(msg.sender, true)
        isActive(to, true)
    {
        BankAccount storage sender = s_bankAccounts[msg.sender];
        BankAccount storage receiver = s_bankAccounts[to];

        require(sender.balance >= amount, "BLXBank: ERROR #3");

        unchecked {
            sender.balance = sender.balance - amount;
            receiver.balance = receiver.balance + amount;

            ++sender.transactionsCount;
        }

        emit Transfered(msg.sender, to, amount);
    }

    /// @notice Lock tokens to a specific user with a specific unlock date.
    /// @param to - address of the receiver.
    /// @param amount - amount of tokens to lock.
    /// @param endTime - time in seconds for unlock amount.
    function lockTokens(
        address to,
        uint256 amount,
        uint256 endTime
    ) external isActive(msg.sender, true) isActive(to, true) checkPause(false) {
        _lockTokens(to, amount, uint64(block.timestamp), endTime, false);
        emit Locked(msg.sender, to, amount, false);
    }

    /// @notice Blocks tokens to a specific user with a linear unlock.
    /// @param to - address of the receiver.
    /// @param amount - amount of tokens to lock.
    /// @param startTime - time in seconds for start vesting.
    /// @param endTime - time in seconds for full unlock.
    function LockTokensWithVesting(
        address to,
        uint256 amount,
        uint88 startTime,
        uint256 endTime
    ) external isActive(msg.sender, true) isActive(to, true) checkPause(false) {
        _lockTokens(to, amount, startTime, endTime, true);
        emit Locked(msg.sender, to, amount, true);
    }

    /// @notice Claim all available tokens in a specific lock.
    /// @param lockId - The lock from which we want to take the tokens.
    function claim(uint256 lockId)
        external
        isActive(msg.sender, true)
        checkPause(false)
    {
        require(
            lockId > 0 && s_bankAccounts[msg.sender].lockersAmount >= lockId,
            "BLXBank: ERROR #8"
        );

        Lock storage currentLock = s_locks[msg.sender][lockId];
        BankAccount storage currentUser = s_bankAccounts[msg.sender];

        uint256 toClaim;

        if (currentLock.isVesting) {
            toClaim = getUnlockedAmount(msg.sender, lockId);
            require(toClaim > 0, "BLXBank: ERROR #6");
        } else {
            require(
                currentLock.endTime <= block.timestamp,
                "BLXBank: ERROR #7"
            );
            toClaim = currentLock.amount;
        }

        require(
            currentLock.claimed + toClaim <= currentLock.amount,
            "BLXBank: ERROR #9"
        );

        unchecked {
            currentLock.claimed = currentLock.claimed + toClaim;
            currentUser.balance = currentUser.balance + toClaim;
            currentUser.lockedBalance = currentUser.lockedBalance - toClaim;
            ++currentUser.transactionsCount;
        }

        emit Claimed(msg.sender, lockId, toClaim);
    }

    /// @notice Returns the unlocked value in a specific lock.
    /// @param receiver User's address.
    /// @param lockId id of the lock, the value in which we want to look.
    function getUnlockedAmount(address receiver, uint256 lockId)
        public
        view
        returns (uint256)
    {
        Lock memory currentLock = s_locks[receiver][lockId];

        uint256 duration = currentLock.endTime - currentLock.startTime;

        if (block.timestamp < currentLock.startTime) {
            return 0;
        } else if (block.timestamp > currentLock.endTime) {
            return currentLock.amount;
        } else {
            return
                (currentLock.amount *
                    (block.timestamp - currentLock.startTime)) / duration;
        }
    }

    /// @notice Get the value - which the user has already taken from the lock.
    /// @param receiver User's address.
    /// @param lockId id of the lock, the value in which we want to look.
    function getClaimedAmount(address receiver, uint256 lockId)
        external
        view
        returns (uint256)
    {
        return s_locks[receiver][lockId].claimed;
    }

    /// @notice Returns the total number of tokens locked for a specific user.
    /// @param receiver - The target for getting a locked balance.
    function getTotalLockedBalance(address receiver)
        external
        view
        returns (uint256)
    {
        return s_bankAccounts[receiver].lockedBalance;
    }

    /** @notice Changes the pause state of the contract to the opposite. 
        Available only to the owner. */
    function flipPause() external onlyOwner {
        bool newStatus = !s_isPaused;
        s_isPaused = newStatus;
        emit PauseChanged(msg.sender, newStatus);
    }

    function _lockTokens(
        address to,
        uint256 amount,
        uint88 startTime,
        uint256 endTime,
        bool isVesting
    ) private {
        require(amount > 0, "BLXBank: ERROR #8");
        require(endTime > block.timestamp, "BLXBank: ERROR #4");

        BankAccount storage sender = s_bankAccounts[msg.sender];
        require(sender.balance >= amount, "BLXBank: ERROR #3");

        BankAccount storage receiver = s_bankAccounts[to];

        unchecked {
            sender.balance = sender.balance - amount;
            ++sender.transactionsCount;

            receiver.lockedBalance = receiver.lockedBalance + amount;
            ++receiver.lockersAmount;
        }

        s_locks[to][receiver.lockersAmount] = Lock(
            msg.sender,
            startTime,
            isVesting,
            endTime,
            amount,
            0
        );
    }

    /// @notice This is required by the standard of upgradeable contracts
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
