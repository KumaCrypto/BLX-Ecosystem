/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { upgrades } from "hardhat";

import {
  BloxifyToken,
  BloxifyToken__factory,
  BLXLocker,
} from "../typechain-types";

async function getCurrentTime() {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
}
async function increaseTime(time: number) {
  await ethers.provider.send("evm_increaseTime", [time]);
}

describe("BLXLock", () => {
  let Bank: any;

  before("Get factorie", async () => {
    Bank = await ethers.getContractFactory("BLXLocker");
  });

  let token: BloxifyToken;
  let signers: SignerWithAddress[];
  let bank: BLXLocker;

  const tokenName: string = "Bloxify Token";
  const tokenSymbol: string = "BLX";
  const initialSupply: BigNumber = ethers.utils.parseEther("1000000000000");
  const zeroBN: BigNumber = BigNumber.from(0);
  const amount: number = 100;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    token = await new BloxifyToken__factory(signers[0]).deploy(
      tokenName,
      tokenSymbol,
      initialSupply
    );

    bank = (await upgrades.deployProxy(Bank, { kind: "uups" })) as BLXLocker;
    await bank.initialaze(token.address);
  });

  describe("Checking genesis setup", () => {
    it("The owner is registered correctly", async () => {
      expect(await bank.owner()).to.eq(signers[0].address);
    });

    it("The token address is registered correctly", async () => {
      expect(await bank.bloxify()).to.eq(token.address);
    });

    it("The bank's balance is 0", async () => {
      expect(await bank.s_bankBalance()).to.eq(0);
    });

    it("The number of users is 0", async () => {
      expect(await bank.s_numberOfUser()).to.eq(0);
    });

    it("The bank is not on pause", async () => {
      expect(await bank.s_isPaused()).to.eq(false);
    });
  });

  describe("CreateBankAccount", () => {
    it("The account is created correctly", async () => {
      await bank.createBankAccount();
      const time = BigNumber.from(await getCurrentTime());
      const account = await bank.s_bankAccounts(signers[0].address);

      expect(account[0]).to.eq(zeroBN); // balance;
      expect(account[1]).to.eq(zeroBN); // lockedBalance;
      expect(account[2]).to.eq(time); // createdAt;
      expect(account[3]).to.eq(zeroBN); // lockersAmount;
      expect(account[4]).to.eq(zeroBN); // transactionsCount;
      expect(account[5]).to.eq(true); // isActive;
    });

    it("Creating an account increases the number of active users", async () => {
      await bank.createBankAccount();
      expect(await bank.s_numberOfUser()).to.eq(1);
    });

    it("Creating an account to emit AccountCreated", async () => {
      await expect(bank.createBankAccount())
        .to.emit(bank, "AccountCreated")
        .withArgs(signers[0].address);
    });

    it("If an account has already been created, it cannot be created again", async () => {
      await bank.createBankAccount();

      await expect(bank.createBankAccount()).to.be.revertedWith(
        "BLXBank: ERROR #2"
      );
    });
  });

  describe("Deposit requirements", () => {
    it("The account must be active", async () => {
      await expect(bank.deposit(amount)).to.be.revertedWith(
        "BLXBank: ERROR #2"
      );
    });

    it("The bank's contract should not be on pause", async () => {
      await bank.createBankAccount();
      await bank.flipPause();

      await expect(bank.deposit(amount)).to.be.revertedWith(
        "BLXBank: ERROR #1"
      );
    });
  });

  describe("Deposit", () => {
    beforeEach(async () => {
      await token.approve(bank.address, initialSupply);
      await bank.createBankAccount();
    });

    it("Increases the user's balance", async () => {
      await bank.deposit(amount);
      const [balance] = await bank.s_bankAccounts(signers[0].address);
      expect(balance).eq(amount);
    });

    it("Increases the number of user transactions", async () => {
      await bank.deposit(amount);
      const [, , , , transactionCount] = await bank.s_bankAccounts(
        signers[0].address
      );
      expect(transactionCount).eq(1);
    });

    it("Increases the global balance of the bank", async () => {
      await bank.deposit(amount);
      expect(await bank.s_bankBalance()).eq(amount);
    });

    it("To emit Deposited event", async () => {
      await expect(bank.deposit(amount))
        .to.emit(bank, "Deposited")
        .withArgs(signers[0].address, amount);
    });
  });

  describe("Withdraw", () => {
    let balanceBefore: BigNumber,
      balanceAfter: BigNumber,
      balance: any,
      transactionNumber: any;

    beforeEach(async () => {
      await token.approve(bank.address, initialSupply);
      await bank.createBankAccount();
      await bank.deposit(amount);
    });

    it("Funds are not withdrawn during the pause of the bank's contract", async () => {
      bank.flipPause();
      await expect(bank.withdraw(amount)).to.be.revertedWith(
        "BLXBank: ERROR #1"
      );
    });

    it("The requirement that the balance be greater than or equal to the withdrawal amount.", async () => {
      await expect(bank.withdraw(amount + 1)).to.be.revertedWith(
        "BLXBank: ERROR #3"
      );
    });

    it("The balance has been reduced by the amount of funds withdrawn", async () => {
      await bank.withdraw(amount / 2);
      [balance] = await bank.s_bankAccounts(signers[0].address);
      expect(balance).eq(amount / 2);
    });

    it("The number of user transactions increases", async () => {
      await bank.withdraw(amount);
      [, , , , transactionNumber] = await bank.s_bankAccounts(
        signers[0].address
      );

      expect(transactionNumber).eq(2);
    });

    it("The bank balance decreases when funds are withdrawn", async () => {
      balanceBefore = await bank.s_bankBalance();
      await bank.withdraw(amount);
      balanceAfter = await bank.s_bankBalance();

      expect(balanceBefore).eq(balanceAfter.add(amount));
    });

    it("The user gets his tokens back", async () => {
      balanceBefore = await token.balanceOf(signers[0].address);
      await bank.withdraw(amount);
      balanceAfter = await token.balanceOf(signers[0].address);

      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("To emit Withdrawn event", async () => {
      await expect(bank.withdraw(amount))
        .to.emit(bank, "Withdrawn")
        .withArgs(signers[0].address, amount);
    });
  });

  describe("DeactivateAccount requirements", () => {
    it("The user's account must be active", async () => {
      await expect(bank.deactivateAccount()).to.be.revertedWith(
        "BLXBank: ERROR #2"
      );
    });
  });

  describe("DeactivateAccount", () => {
    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.deposit(amount);
    });

    it("If the balance is greater than 0, then return the user his funds", async () => {
      const balanceBefore = await token.balanceOf(signers[0].address);
      await bank.deactivateAccount();
      const balanceAfter = await token.balanceOf(signers[0].address);

      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("The user has been removed from the contract", async () => {
      await bank.deactivateAccount();
      const bankAccount = await bank.s_bankAccounts(signers[0].address);

      expect(bankAccount[0]).to.eq(zeroBN); // balance;
      expect(bankAccount[1]).to.eq(zeroBN); // lockedBalance;
      expect(bankAccount[2]).to.eq(zeroBN); // createdAt;
      expect(bankAccount[3]).to.eq(zeroBN); // lockersAmount;
      expect(bankAccount[4]).to.eq(zeroBN); // transactionsCount;
      expect(bankAccount[5]).to.eq(false); // isActive;
    });

    it("The user has been removed from the contract with the 0 balance", async () => {
      await bank.withdraw(amount);
      await bank.deactivateAccount();
      const bankAccount = await bank.s_bankAccounts(signers[0].address);

      expect(bankAccount[0]).to.eq(zeroBN); // balance;
      expect(bankAccount[1]).to.eq(zeroBN); // lockedBalance;
      expect(bankAccount[2]).to.eq(zeroBN); // createdAt;
      expect(bankAccount[3]).to.eq(zeroBN); // lockersAmount;
      expect(bankAccount[4]).to.eq(zeroBN); // transactionsCount;
      expect(bankAccount[5]).to.eq(false); // isActive;
    });

    it("The number of active users is decreasing", async () => {
      await bank.deactivateAccount();
      expect(await bank.s_numberOfUser()).eq(0);
    });

    it("To emit AccountDeactivated event", async () => {
      await expect(bank.deactivateAccount())
        .to.emit(bank, "AccountDeactivated")
        .withArgs(signers[0].address);
    });
  });

  describe("Transfer requirements", () => {
    it("The sender's account must be active", async () => {
      await expect(
        bank.transfer(signers[1].address, amount)
      ).to.be.revertedWith("BLXBank: ERROR #2");
    });

    it("The receiver's account must be active", async () => {
      await bank.createBankAccount();
      await expect(
        bank.transfer(signers[1].address, amount)
      ).to.be.revertedWith("BLXBank: ERROR #2");
    });

    it("The bank account should not be on pause", async () => {
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.flipPause();

      await expect(
        bank.transfer(signers[1].address, amount)
      ).to.be.revertedWith("BLXBank: ERROR #1");
    });

    it("The sender should have enough balance", async () => {
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await expect(
        bank.transfer(signers[1].address, amount)
      ).to.be.revertedWith("BLXBank: ERROR #3");
    });
  });

  describe("Transfer", () => {
    let balanceBefore: BigNumber, balanceAfter: BigNumber;

    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();
      await bank.deposit(amount);
    });

    it("The correct number of tokens is debited from the sender", async () => {
      [balanceBefore] = await bank.s_bankAccounts(signers[0].address);
      await bank.transfer(signers[1].address, amount);
      [balanceAfter] = await bank.s_bankAccounts(signers[0].address);

      expect(balanceBefore).eq(balanceAfter.add(amount));
    });

    it("The recipient has credited the correct number of tokens", async () => {
      [balanceBefore] = await bank.s_bankAccounts(signers[1].address);
      await bank.transfer(signers[1].address, amount);
      [balanceAfter] = await bank.s_bankAccounts(signers[1].address);

      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("The number of sender's transactions has been increased", async () => {
      const [, , , , transactionAmountBefore] = await bank.s_bankAccounts(
        signers[0].address
      );
      await bank.transfer(signers[1].address, amount);
      const [, , , , transactionAmountAfter] = await bank.s_bankAccounts(
        signers[0].address
      );

      expect(transactionAmountBefore.add(1)).eq(transactionAmountAfter);
    });

    it("To emit Transfered event", async () => {
      await expect(bank.transfer(signers[1].address, amount))
        .to.emit(bank, "Transfered")
        .withArgs(signers[0].address, signers[1].address, amount);
    });
  });

  describe("FlipPause", () => {
    it("Only the owner has access", async () => {
      await expect(bank.connect(signers[1]).flipPause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("The pause state changes correctly", async () => {
      const oldStatus = await bank.s_isPaused();
      await bank.flipPause();
      expect(oldStatus).is.not.eq(await bank.s_isPaused());
    });

    it("To emit PauseChanged event", async () => {
      await expect(bank.flipPause())
        .to.emit(bank, "PauseChanged")
        .withArgs(signers[0].address, true);

      await expect(bank.flipPause())
        .to.emit(bank, "PauseChanged")
        .withArgs(signers[0].address, false);
    });
  });

  describe("lockTokens requirements", () => {
    it("The sender account must be active", async () => {
      await expect(
        bank.lockTokens(
          signers[1].address,
          amount,
          (await getCurrentTime()) + amount
        )
      ).to.be.revertedWith("BLXBank: ERROR #2");
    });

    it("The recipient account must be active", async () => {
      await bank.createBankAccount();
      await expect(
        bank.lockTokens(
          signers[1].address,
          amount,
          (await getCurrentTime()) + amount
        )
      ).to.be.revertedWith("BLXBank: ERROR #2");
    });

    it("The bank's contract should not be on pause", async () => {
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();
      await bank.flipPause();

      await expect(
        bank.lockTokens(
          signers[1].address,
          amount,
          (await getCurrentTime()) + amount
        )
      ).to.be.revertedWith("BLXBank: ERROR #1");
    });

    it("The end time of the lock must be greater than the current time.", async () => {
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await expect(
        bank.lockTokens(
          signers[1].address,
          amount,
          (await getCurrentTime()) - 1
        )
      ).to.be.revertedWith("BLXBank: ERROR #4");
    });

    it("There should be enough funds on the sender's balance.", async () => {
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await expect(
        bank.lockTokens(
          signers[1].address,
          amount,
          (await getCurrentTime()) + amount
        )
      ).to.be.revertedWith("BLXBank: ERROR #3");
    });

    it("The quantity is 0.", async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      await expect(
        bank.lockTokens(
          signers[1].address,
          0,
          (await getCurrentTime()) + amount
        )
      ).to.be.revertedWith("BLXBank: ERROR #8");
    });
  });

  describe("lockTokens", () => {
    let balanceBefore,
      balanceAfter,
      numberOfTransactionBefore,
      numberOfTransactionAfter;

    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);
    });

    it("The sender's balance has been reduced correctly.", async () => {
      [balanceBefore] = await bank.s_bankAccounts(signers[0].address);

      await bank.lockTokens(
        signers[1].address,
        amount,
        (await getCurrentTime()) + amount
      );

      [balanceAfter] = await bank.s_bankAccounts(signers[0].address);
      expect(balanceBefore).eq(balanceAfter.add(amount));
    });

    it("The number of sender transactions increased", async () => {
      [, , , , numberOfTransactionBefore] = await bank.s_bankAccounts(
        signers[0].address
      );

      await bank.lockTokens(
        signers[1].address,
        amount,
        (await getCurrentTime()) + amount
      );

      [, , , , numberOfTransactionAfter] = await bank.s_bankAccounts(
        signers[0].address
      );

      expect(numberOfTransactionBefore.add(1)).eq(numberOfTransactionAfter);
    });

    it("The recipient's blocked balance has been increased", async () => {
      balanceBefore = await bank.s_bankAccounts(signers[1].address);

      await bank.lockTokens(
        signers[1].address,
        amount,
        (await getCurrentTime()) + amount
      );

      balanceAfter = await bank.s_bankAccounts(signers[1].address);
      expect(balanceBefore[1].add(amount)).eq(balanceAfter[1]);
    });

    it("The number of active locks for the recipient has increased", async () => {
      [, , , numberOfTransactionBefore] = await bank.s_bankAccounts(
        signers[1].address
      );

      await bank.lockTokens(
        signers[1].address,
        amount,
        (await getCurrentTime()) + amount
      );

      [, , , numberOfTransactionAfter] = await bank.s_bankAccounts(
        signers[1].address
      );
      expect(numberOfTransactionBefore.add(1)).eq(numberOfTransactionAfter);
    });

    it("The lock was created correctly", async () => {
      const time = await getCurrentTime();

      await bank.lockTokens(signers[1].address, amount, time + amount);

      const lock = await bank.s_locks(signers[1].address, 1);

      expect(lock[0]).eq(signers[0].address);
      expect(lock[1]).eq(time + 1);
      expect(lock[2]).eq(false);
      expect(lock[3]).eq(time + amount);
      expect(lock[4]).eq(amount);
      expect(lock[5]).eq(0);
    });

    it("To emit Locked event", async () => {
      const time = await getCurrentTime();

      await expect(bank.lockTokens(signers[1].address, amount, time + amount))
        .to.emit(bank, "Locked")
        .withArgs(signers[0].address, signers[1].address, amount, false);
    });
  });

  describe("LockTokensWithVesting", () => {
    let time;
    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);
    });

    it("Works correctly", async () => {
      time = await getCurrentTime();
      await bank.LockTokensWithVesting(
        signers[1].address,
        amount,
        time,
        time + amount
      );
      const lock = await bank.s_locks(signers[1].address, 1);

      expect(lock[0]).eq(signers[0].address);
      expect(lock[1]).eq(time);
      expect(lock[2]).eq(true);
      expect(lock[3]).eq(time + amount);
      expect(lock[4]).eq(amount);
      expect(lock[5]).eq(0);
    });

    it("To emit Locked event", async () => {
      time = await getCurrentTime();
      await expect(
        bank.LockTokensWithVesting(
          signers[1].address,
          amount,
          time,
          time + amount
        )
      )
        .to.emit(bank, "Locked")
        .withArgs(signers[0].address, signers[1].address, amount, true);
    });
  });

  describe("Claim requirements", () => {
    let time;

    it("There is no such lock", async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      time = await getCurrentTime();
      await bank.LockTokensWithVesting(
        signers[1].address,
        amount,
        time,
        time + amount
      );

      await expect(bank.connect(signers[1]).claim(2)).to.be.revertedWith(
        "BLXBank: ERROR #8"
      );
    });

    it("The amount of funds should not be equal to 0", async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      time = (await getCurrentTime()) * 2;
      await bank.LockTokensWithVesting(
        signers[1].address,
        amount,
        time,
        time + amount
      );

      await expect(bank.connect(signers[1]).claim(1)).to.be.revertedWith(
        "BLXBank: ERROR #6"
      );
    });

    it("Not enough time has passed", async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      time = (await getCurrentTime()) * 2;
      await bank.lockTokens(signers[1].address, amount, time);

      await expect(bank.connect(signers[1]).claim(1)).to.be.revertedWith(
        "BLXBank: ERROR #7"
      );
    });

    it("All funds have already been withdrawn", async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      time = (await getCurrentTime()) + amount;
      await bank.lockTokens(signers[1].address, amount, time);

      await increaseTime(time + 1);
      await bank.connect(signers[1]).claim(1);

      await expect(bank.connect(signers[1]).claim(1)).to.be.revertedWith(
        "BLXBank: ERROR #9"
      );
    });
  });

  describe("Claim with a fixed date", () => {
    let time,
      claimedBefore,
      claimedAfter,
      balanceBefore,
      balanceAfter,
      transactionAmountBefore,
      transactionAmountAfter;

    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      time = (await getCurrentTime()) + amount;
      await bank.lockTokens(signers[1].address, amount, time);

      await increaseTime(time + 1);
    });

    it("The claimed amount is recorded in the claimed", async () => {
      [, , , , , claimedBefore] = await bank.s_locks(signers[1].address, 1);
      await bank.connect(signers[1]).claim(1);
      [, , , , , claimedAfter] = await bank.s_locks(signers[1].address, 1);

      expect(claimedBefore.add(amount)).eq(claimedAfter);
    });

    it("Balance increased", async () => {
      [balanceBefore] = await bank.s_bankAccounts(signers[1].address);
      await bank.connect(signers[1]).claim(1);
      [balanceAfter] = await bank.s_bankAccounts(signers[1].address);

      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("The locked balance has been reduced", async () => {
      [, balanceBefore] = await bank.s_bankAccounts(signers[1].address);
      await bank.connect(signers[1]).claim(1);
      [, balanceAfter] = await bank.s_bankAccounts(signers[1].address);

      expect(balanceBefore.sub(amount)).eq(balanceAfter);
    });

    it("The number of transactions has been increased", async () => {
      [, , , , transactionAmountBefore] = await bank.s_bankAccounts(
        signers[1].address
      );
      await bank.connect(signers[1]).claim(1);
      [, , , , transactionAmountAfter] = await bank.s_bankAccounts(
        signers[1].address
      );

      expect(transactionAmountBefore.add(1)).eq(transactionAmountAfter);
    });

    it("To emit Claimed event", async () => {
      await expect(bank.connect(signers[1]).claim(1))
        .to.emit(bank, "Claimed")
        .withArgs(signers[1].address, 1, amount);
    });
  });

  describe("Claim vesting", () => {
    let startTime, endTime, balanceBefore, balanceAfter;

    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);

      startTime = (await getCurrentTime()) + 1;
      endTime = startTime + amount * 2;
      await bank.LockTokensWithVesting(
        signers[1].address,
        amount,
        startTime,
        endTime
      );

      await increaseTime(amount);
    });

    it("Balance increased", async () => {
      [balanceBefore] = await bank.s_bankAccounts(signers[1].address);
      await bank.connect(signers[1]).claim(1);
      [balanceAfter] = await bank.s_bankAccounts(signers[1].address);
      expect(balanceBefore.add(50)).eq(balanceAfter);
    });

    it("Time passed - balance increased", async () => {
      await increaseTime(amount * 2);
      [balanceBefore] = await bank.s_bankAccounts(signers[1].address);
      await bank.connect(signers[1]).claim(1);
      [balanceAfter] = await bank.s_bankAccounts(signers[1].address);
      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("To emit Claimed event", async () => {
      await expect(bank.connect(signers[1]).claim(1))
        .to.emit(bank, "Claimed")
        .withArgs(signers[1].address, 1, amount / 2);
    });
  });

  describe("Test of viewing functions", () => {
    let claimed: BigNumber, lockedBalance: BigNumber;

    beforeEach(async () => {
      await token.approve(bank.address, amount);
      await bank.createBankAccount();
      await bank.connect(signers[1]).createBankAccount();

      await bank.deposit(amount);
      await bank.lockTokens(
        signers[1].address,
        amount,
        (await getCurrentTime()) + amount
      );
    });

    it("getClaimedAmount - zero", async () => {
      claimed = await bank.getClaimedAmount(signers[1].address, 1);
      expect(claimed).eq(0);
    });

    it("getClaimedAmount - full amount", async () => {
      await increaseTime(amount + 1);
      await bank.connect(signers[1]).claim(1);

      claimed = await bank.getClaimedAmount(signers[1].address, 1);

      expect(claimed).eq(amount);
    });

    it("getTotalLockedBalance - return a correct amount", async () => {
      lockedBalance = await bank.getTotalLockedBalance(signers[1].address);
      expect(lockedBalance).eq(amount);
    });

    it("getTotalLockedBalance - return a correct amount after claim", async () => {
      await increaseTime(amount + 1);
      await bank.connect(signers[1]).claim(1);
      lockedBalance = await bank.getTotalLockedBalance(signers[1].address);
      expect(lockedBalance).eq(0);
    });
  });
});
