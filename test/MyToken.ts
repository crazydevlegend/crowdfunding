import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractFactory, Contract } from "ethers";

describe("MyToken", function () {
  let Token: ContractFactory;
  let token: Contract;
  let owner: SignerWithAddress;
  let funder1: SignerWithAddress;
  let funder2: SignerWithAddress;
  const TOTAL_SUPPLY = 10000000000000;
  const TRANSFER_AMOUNT = 10000000000;

  beforeEach(async () => {
    [owner, funder1, funder2] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MyToken");
    token = await Token.deploy(TOTAL_SUPPLY);
    await token.deployed();
  });

  it("Deployment: Mint all tokens to deployer", async () => {
    const deployerBalance = await token.balanceOf(owner.address);
    const userBalance = await token.balanceOf(funder1.address);
    expect(deployerBalance).to.equal(TOTAL_SUPPLY);
    expect(userBalance).to.equal(0);
  });
  it("Transfer: transfer token between accounts", async () => {
    await expect(token.transfer(funder1.address, TRANSFER_AMOUNT))
      .to.changeTokenBalance(token, owner.address, -TRANSFER_AMOUNT)
      .to.changeTokenBalance(token, funder1.address, TRANSFER_AMOUNT)
      .emit(token, "Transfer");
  });
});
