import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deployer addresses: ${owner.address}`);
  console.log(
    `======================================================================`
  );

  const TOTAL_SUPPLY = 10000000000000;
  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(TOTAL_SUPPLY);
  await token.deployed();

  const Campaign = await ethers.getContractFactory("Campaign");
  const campaign = await Campaign.deploy(token.address);
  await campaign.deployed();

  console.log(`Crowdfund Token deployed to ${token.address}`);
  console.log(`Crowdfunding Campaign Contract deployed to ${campaign.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
