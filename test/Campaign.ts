import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ContractFactory, Contract } from "ethers";

describe("Campaign", function () {
  let Token: ContractFactory;
  let token: Contract;
  let Campaign: ContractFactory;
  let campaign: Contract;
  let deployer: SignerWithAddress;
  let projectOwner: SignerWithAddress;
  let funder: SignerWithAddress;

  const TOTAL_SUPPLY = 10000000000000;
  const FUNDING_GOAL = 10000000000;
  const ONE_DAY_IN_SECS = 24 * 60 * 60;

  beforeEach(async () => {
    [deployer, projectOwner, funder] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MyToken");
    token = await Token.deploy(TOTAL_SUPPLY);
    await token.deployed();

    Campaign = await ethers.getContractFactory("CampaignV1");
    campaign = await upgrades.deployProxy(Campaign, [token.address], {
      initializer: "initialize",
    });
    await campaign.deployed();
  });

  describe("Upgradeability", async () => {
    it("Before upgrading: version() should 1", async () => {
      expect(await campaign.version()).to.equal(1);
    });
    it("After upgrading: version() should 2", async () => {
      const CampaignV2 = await ethers.getContractFactory("CampaignV2");
      campaign = await upgrades.upgradeProxy(campaign.address, CampaignV2);
      expect(await campaign.version()).to.equal(2);
    });
  });

  describe("Project Owner", async () => {
    it("Create campaign", async () => {
      // CAMPAIGN for one day
      await expect(
        campaign
          .connect(projectOwner)
          .createProject(FUNDING_GOAL, ONE_DAY_IN_SECS)
      )
        .to.emit(campaign, "ProjectCreated")
        .withArgs(1, projectOwner.address, FUNDING_GOAL, ONE_DAY_IN_SECS);
    });
    it("Withdrawable after fund-raising (only project owner)", async () => {
      const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS;

      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await campaign
        .connect(projectOwner)
        .createProject(FUNDING_GOAL, ONE_DAY_IN_SECS);
      await campaign.connect(funder).fundProject(1, FUNDING_GOAL);

      await time.increaseTo(unlockTime);

      expect((await campaign.projects(1)).isRaised).to.be.true;
      await expect(campaign.withdrawFunds(1)).to.revertedWith(
        "Not project owner"
      );
    });
    it("Cannot withdraw before campaign hits the timeline", async () => {
      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await campaign
        .connect(projectOwner)
        .createProject(FUNDING_GOAL, ONE_DAY_IN_SECS);
      await campaign.connect(funder).fundProject(1, FUNDING_GOAL);

      expect((await campaign.projects(1)).isRaised).to.be.true;
      await expect(
        campaign.connect(projectOwner).withdrawFunds(1)
      ).to.revertedWith("Campaign is still ongoing");
    });
    it("Withdraw fund in case of success", async () => {
      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await campaign
        .connect(projectOwner)
        .createProject(FUNDING_GOAL, ONE_DAY_IN_SECS);
      await campaign.connect(funder).fundProject(1, FUNDING_GOAL);

      const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS;
      await time.increaseTo(unlockTime);

      expect((await campaign.projects(1)).isRaised).to.be.true;
      await expect(campaign.connect(projectOwner).withdrawFunds(1))
        .to.emit(campaign, "FundWithdrawn")
        .withArgs(1, FUNDING_GOAL);
    });
  });

  describe("Funder", async () => {
    beforeEach(async () => {
      await campaign
        .connect(projectOwner)
        .createProject(FUNDING_GOAL, ONE_DAY_IN_SECS);
    });

    it("Campaign over: not able to fund anymore", async () => {
      const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS;
      await time.increaseTo(unlockTime);
      await expect(
        campaign.connect(funder).fundProject(1, FUNDING_GOAL)
      ).to.revertedWith("Campaign is over");
    });
    it("Campaign is incomplete before it reaches its funding goal", async () => {
      expect((await campaign.projects(1)).isRaised).to.be.false;
    });
    it("Campaign is complete after it reaches its funding goal", async () => {
      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await expect(campaign.connect(funder).fundProject(1, FUNDING_GOAL))
        .to.emit(campaign, "ProjectfundingGoalReached")
        .withArgs(1);
      const project = await campaign.projects(1);
      expect(project.isRaised).to.be.true;
    });
    it("Cannot refund pledges if campaign succeeds", async () => {
      const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS;

      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await campaign.connect(funder).fundProject(1, FUNDING_GOAL);

      await time.increaseTo(unlockTime);

      expect((await campaign.projects(1)).isRaised).to.be.true;
      await expect(campaign.connect(funder).refundPledge(1)).to.revertedWith(
        "Campaign is raised successfully, cannot refund"
      );
    });

    it("RRefundable if campaign fails", async () => {
      const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS;

      await token.transfer(funder.address, FUNDING_GOAL);
      token.connect(funder).approve(campaign.address, FUNDING_GOAL);

      await campaign.connect(funder).fundProject(1, FUNDING_GOAL / 2);

      await time.increaseTo(unlockTime);

      expect((await campaign.projects(1)).isRaised).to.be.false;
      await expect(campaign.connect(funder).refundPledge(1))
        .to.changeTokenBalances(
          token,
          [campaign.address, funder.address],
          [-FUNDING_GOAL / 2, FUNDING_GOAL / 2]
        )
        .to.emit(campaign, "FundsRefunded")
        .withArgs(1, funder.address, FUNDING_GOAL / 2);
    });
  });
});
