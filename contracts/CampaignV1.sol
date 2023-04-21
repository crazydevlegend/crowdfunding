// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CampaignV1 is Initializable {
    struct Project {
        address owner; // project owner
        uint256 fundingGoal; // goal of the project
        uint256 timeline; // timeline of the campaign
        uint256 totalFunds; // total amount of pledged funds
        bool isRaised; // whether fund is successfully raised or not
        mapping(address => uint256) pledges; // mapping of pledges
    }

    IERC20 public myToken; // interface to crowdfund token
    uint256 public projectCounter; // counter of the project
    mapping(uint256 => Project) public projects; // list of projects

    event ProjectCreated(
        uint256 projectId,
        address owner,
        uint256 fundingGoal,
        uint256 timeline
    );
    event ProjectFunded(uint256 projectId, address funder, uint256 amount);
    event ProjectfundingGoalReached(uint256 projectId);
    event FundsRefunded(uint256 projectId, address funder, uint256 amount);
    event FundWithdrawn(uint256 projectId, uint256 amount);

    function initialize(address tokenAddress) public initializer {
        myToken = IERC20(tokenAddress);
    }

    modifier onlyProjectOwner(uint256 projectId) {
        require(projects[projectId].owner == msg.sender, "Not project owner");
        _;
    }

    function version() public pure returns (uint) {
        return 1;
    }

    function createProject(uint256 fundingGoal, uint256 duration) external {
        require(fundingGoal > 0, "Invalid funding goal");
        require(duration > 0, "Invalid timeline");

        projectCounter++;

        Project storage newProject = projects[projectCounter];

        newProject.owner = msg.sender;
        newProject.fundingGoal = fundingGoal;
        newProject.timeline = block.timestamp + duration;
        newProject.isRaised = false;
        newProject.totalFunds = 0;

        emit ProjectCreated(projectCounter, msg.sender, fundingGoal, duration);
    }

    function fundProject(uint256 projectId, uint256 amount) external {
        require(
            projectId > 0 && projectId <= projectCounter,
            "Invalid project ID"
        );

        Project storage project = projects[projectId];
        require(block.timestamp < project.timeline, "Campaign is over");
        require(!project.isRaised, "Campaign is funded");

        require(
            myToken.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        project.pledges[msg.sender] += amount;
        project.totalFunds += amount;

        emit ProjectFunded(projectId, msg.sender, amount);

        if (project.totalFunds >= project.fundingGoal) {
            project.isRaised = true;
            emit ProjectfundingGoalReached(projectId);
        }
    }

    function withdrawFunds(
        uint256 projectId
    ) external onlyProjectOwner(projectId) {
        Project storage project = projects[projectId];
        require(project.isRaised, "Campaign not funded yet");
        require(
            block.timestamp >= project.timeline,
            "Campaign is still ongoing"
        );

        uint256 amount = project.totalFunds;
        project.totalFunds = 0;
        require(
            myToken.transfer(project.owner, amount),
            "Token transfer failed"
        );
        emit FundWithdrawn(projectId, amount);
    }

    function refundPledge(uint256 projectId) external {
        require(
            projectId > 0 && projectId <= projectCounter,
            "Invalid project ID"
        );

        Project storage project = projects[projectId];
        require(
            block.timestamp >= project.timeline,
            "Campaign is still ongoing"
        );
        require(
            !project.isRaised,
            "Campaign is raised successfully, cannot refund"
        );

        uint256 amount = project.pledges[msg.sender];
        require(amount > 0, "No funds pledged");

        project.pledges[msg.sender] = 0;
        project.totalFunds -= amount;

        require(myToken.transfer(msg.sender, amount), "Token transfer failed");
        emit FundsRefunded(projectId, msg.sender, amount);
    }
}
