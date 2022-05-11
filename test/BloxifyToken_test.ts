/* eslint-disable prettier/prettier */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { BloxifyToken, BloxifyToken__factory } from "../typechain-types";

describe("BloxifyToken", () => {
  let token: BloxifyToken;
  let signers: SignerWithAddress[];

  const tokenName: string = "Bloxify Token";
  const tokenSymbol: string = "BLX";
  const initialSupply: BigNumber = ethers.utils.parseEther("1000000000000");
  const amount: number = 100;
  const zeroAddress = ethers.constants.AddressZero;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    token = await new BloxifyToken__factory(signers[0]).deploy(
      tokenName,
      tokenSymbol,
      1000000000000
    );
  });

  describe("Checking genesis setup", () => {
    it("Name is correct", async () => {
      expect(await token.name()).to.eq(tokenName);
    });

    it("Symbol is correct", async () => {
      expect(await token.symbol()).to.eq(tokenSymbol);
    });

    it("Decimals is correct", async () => {
      expect(await token.decimals()).to.eq(18);
    });

    it("TotalSupply is correct", async () => {
      expect(await token.totalSupply()).to.eq(initialSupply);
    });

    it("TotalSupply == deployer balances", async () => {
      expect(await token.totalSupply()).to.eq(
        await token.balanceOf(signers[0].address)
      );
    });
  });

  describe("Transfer", () => {
    let balanceBefore: BigNumber;
    let balanceAfter: BigNumber;

    it("Transfer reduces the sender's balance", async () => {
      balanceBefore = await token.balanceOf(signers[0].address);

      await token.transfer(signers[1].address, amount);

      balanceAfter = await token.balanceOf(signers[0].address);
      expect(balanceBefore).to.eq(balanceAfter.add(amount));
    });

    it("Transfer increases the recipient's balance", async () => {
      const balanceBefore = await token.balanceOf(signers[1].address);

      await token.transfer(signers[1].address, amount);

      const balanceAfter = await token.balanceOf(signers[1].address);
      expect(balanceBefore).to.eq(balanceAfter.sub(amount));
    });

    it("The transfer will emit an event", async () => {
      expect(await token.transfer(signers[1].address, amount))
        .to.emit(token, "Transfer")
        .withArgs(signers[0].address, signers[1].address, amount);
    });

    it("The requirement that the addressee is not a zero address", async () => {
      await expect(token.transfer(zeroAddress, amount)).to.be.revertedWith(
        "ERC20: transfer to the zero address"
      );
    });

    it("The requirement that the sender is not a null address", async () => {
      await expect(
        token.connect(zeroAddress).transfer(signers[0].address, amount)
      ).to.be.revertedWith("ERC20: transfer from the zero address");
    });

    it("The requirement that the balance be >= the amount of sending", async () => {
      await expect(
        token.connect(signers[1]).transfer(signers[2].address, amount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Allowance", () => {
    it("Initially, the allowance is 0", async () => {
      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(0);
    });

    it("Approval increases", async () => {
      await token.approve(signers[1].address, amount);
      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(amount);
    });

    it("Approval will emited upon approval ", async () => {
      expect(await token.approve(signers[1].address, amount))
        .to.emit(token, "Approval")
        .withArgs(signers[0].address, signers[1].address, amount);
    });
  });

  describe("transferFrom", () => {
    it("transferFrom spend approval", async () => {
      await token.approve(signers[1].address, amount);

      await token
        .connect(signers[1])
        .transferFrom(signers[0].address, signers[2].address, amount);

      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(0);
    });
  });

  describe("Increasing & decreasing allowances", () => {
    it("Allowance increased", async () => {
      await token.increaseAllowance(signers[1].address, amount);

      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(amount);
    });

    it("SpendAllowance decresed allowances", async () => {
      await token.increaseAllowance(signers[1].address, amount);
      await token.decreaseAllowance(signers[1].address, amount);

      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(0);
    });

    it("Not enough approval to make the transfer", async () => {
      await expect(
        token
          .connect(signers[1])
          .transferFrom(signers[0].address, signers[2].address, amount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("You can't reduce the approval to less than zero", async () => {
      await expect(
        token.decreaseAllowance(signers[1].address, amount)
      ).to.be.revertedWith("ERC20: decreased allowance below zero");
    });

    it("Allowance decreased", async () => {
      await token.increaseAllowance(signers[1].address, amount);

      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(amount);

      await token.decreaseAllowance(signers[1].address, amount);

      expect(
        await token.allowance(signers[0].address, signers[1].address)
      ).to.eq(0);
    });
  });

  describe("Mint", () => {
    it("Anyone can mint tokens for themselves", async () => {
      await token.connect(signers[1]).mint(amount);

      expect(await token.balanceOf(signers[1].address)).to.eq(amount);

      await token.connect(signers[2]).mint(amount);

      expect(await token.balanceOf(signers[2].address)).to.eq(amount);

      await token.connect(signers[3]).mint(amount);

      expect(await token.balanceOf(signers[3].address)).to.eq(amount);
    });

    it("Total suply changed", async () => {
      const totalSupplyBefore = await token.totalSupply();

      await token.mint(amount);

      const totalSupplyAfter = await token.totalSupply();
      expect(totalSupplyBefore).to.eq(totalSupplyAfter.sub(amount));
    });

    it("Mint to emit the transfer", async () => {
      await expect(token.mint(amount))
        .to.emit(token, "Transfer")
        .withArgs(zeroAddress, signers[0].address, amount);
    });
  });
});
