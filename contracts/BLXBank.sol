// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IBloxifyToken.sol";

// Error list:
//     ERROR #1 = The current pause state does not match the requested one;
//     ERROR #2 = Expectations on account activity status - do not match;
//     ERROR #3 = The requested value is greater than your balance;

/// @title A bank where users can create an account and store BLX tokens.
/// @author Vladimir Kumalagov.
contract BLXBank is Ownable {
    using SafeERC20 for IBloxifyToken;

    /// @notice BloxifyToken contract.
    /// @dev To save gas - made as immutable.
    IBloxifyToken public immutable bloxify;

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
        Time of creation,
        balance,
        number of operations performed,
        account status
    */
    /// @dev transactionsCount is uint248 in order for the next variable of type bool to fit into the same slot.
    struct BankAccount {
        uint256 createdAt;
        uint256 balance;
        uint248 transactionsCount;
        bool isActive;
    }

    /// @notice Mapping the user's address with his personal account.
    mapping(address => BankAccount) public s_bankAccounts;

    /// @param _bloxify - is address of the bloxify token contract.
    constructor(IBloxifyToken _bloxify) {
        bloxify = _bloxify;
    }

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
        s_bankAccounts[msg.sender] = BankAccount(block.timestamp, 0, 0, true);
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

    /** @notice Changes the pause state of the contract to the opposite. 
        Available only to the owner. */
    function flipPause() external onlyOwner {
        bool newStatus = !s_isPaused;
        s_isPaused = newStatus;
        emit PauseChanged(msg.sender, newStatus);
    }
}
