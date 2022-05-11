/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import {
  BloxifyToken,
  BloxifyToken__factory,
  BLXBank,
  BLXBank__factory,
} from "../typechain-types";

async function getCurrentTime() {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
}

describe("BLXBank", () => {
  let token: BloxifyToken;
  let bank: BLXBank;
  let signers: SignerWithAddress[];

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
    bank = await new BLXBank__factory(signers[0]).deploy(token.address);
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

      expect(account[0]).to.eq(time);
      expect(account[1]).to.eq(zeroBN);
      expect(account[2]).to.eq(zeroBN);
      expect(account[3]).to.eq(true);
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
      const [, balance, ,] = await bank.s_bankAccounts(signers[0].address);
      expect(balance).eq(amount);
    });

    it("Increases the number of user transactions", async () => {
      await bank.deposit(amount);
      const [, , transactionCount] = await bank.s_bankAccounts(
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
    let balanceBefore: BigNumber, balanceAfter: BigNumber, balance: any;

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
      [, balance, ,] = await bank.s_bankAccounts(signers[0].address);
      expect(balance).eq(amount / 2);
    });

    it("The number of user transactions increases", async () => {
      await bank.withdraw(amount);
      [, , balance] = await bank.s_bankAccounts(signers[0].address);

      expect(balance).eq(2);
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

      expect(bankAccount[0]).eq(zeroBN);
      expect(bankAccount[1]).eq(zeroBN);
      expect(bankAccount[2]).eq(zeroBN);
      expect(bankAccount[3]).eq(false);
    });

    it("The user has been removed from the contract with the 0 balance", async () => {
      await bank.withdraw(amount);
      await bank.deactivateAccount();
      const bankAccount = await bank.s_bankAccounts(signers[0].address);

      expect(bankAccount[0]).eq(zeroBN);
      expect(bankAccount[1]).eq(zeroBN);
      expect(bankAccount[2]).eq(zeroBN);
      expect(bankAccount[3]).eq(false);
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
      [, balanceBefore, ,] = await bank.s_bankAccounts(signers[0].address);
      await bank.transfer(signers[1].address, amount);
      [, balanceAfter, ,] = await bank.s_bankAccounts(signers[0].address);

      expect(balanceBefore).eq(balanceAfter.add(amount));
    });

    it("The recipient has credited the correct number of tokens", async () => {
      [, balanceBefore, ,] = await bank.s_bankAccounts(signers[1].address);
      await bank.transfer(signers[1].address, amount);
      [, balanceAfter, ,] = await bank.s_bankAccounts(signers[1].address);

      expect(balanceBefore.add(amount)).eq(balanceAfter);
    });

    it("The number of sender's transactions has been increased", async () => {
      const [, , transactionAmountBefore] = await bank.s_bankAccounts(
        signers[0].address
      );
      await bank.transfer(signers[1].address, amount);
      const [, , transactionAmountAfter] = await bank.s_bankAccounts(
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
});
