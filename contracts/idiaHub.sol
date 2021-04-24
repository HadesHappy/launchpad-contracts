// SPDX-License-Identifier: MIT
// TODO: QUICK EXPLAINER
pragma solidity ^0.8.0;

import "./lib/IERC20.sol";
import "./lib/Math.sol";
import "./lib/SafeMath.sol";
import "./idiaToken.sol";  // TODO: need to add new .sol file for whatever we launch of the idia token
import "./lib/Ownable.sol";
import "./lib/SafeERC20.sol";

contract idiaHub is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    // Info of each user.
    struct userInfo {
        uint256 stakedAmount;     // How many IDIA tokens the user has provided to a given track
        uint256 stakeDuration;   // How to let users stake multiple durations? force them to stake into discrete staking options? 
        // where options 1-4 could be weeks, months, years etc. for a multiplier on power.
        uint256 stakePower; // the calculated weight of the user's proportion
        uint256 lastDepositBlockStamp; // records the time of last deposit to properly calculate stake age
        // Update both amount deposited and accruedStakeAge every time a deposit or withdraw happens
    }
    // Info of each pool.
    struct trackInfo {
        uint256 trackId;     // id of the track
        uint256 lastCampaignTime; // Records the last time that a launchpad took place in this track
        uint256 totalDeposit = 0; // Tracker of the total deposits within a pool, starts at 0.
        // TODO: decide if we can use balanceOf this account when needed
        // TODO: Decide if both of these are necessary - for now will just save in this spot and ignore if not needed later
        uint256 ceilingDeposit = 25000000000000000000000000; //creating a ceiling is for depositing into the pool, where penalty may be levied later on
        uint256 floorDeposit = 250000000000000000000000; //creating a floor deposit to ensure that every track has some liquidity in the long run
        // User and decision
         }

    // TODO: make sure the structure is proper such that userInfo is contained within a trackInfo
    // Info of each track.
    trackInfo[] public trackInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => userInfo)) public userInfo;
    // The block number when idia mining starts. // startblock = when protocol is first launched
    uint256 public startBlock;
    event Stake(address indexed user, uint256 indexed pid, uint256 trackId, uint256 amount);
    event Unstake(address indexed user, uint256 indexed pid, uint256 trackId, uint256 amount);
    event EmergencyUnstake(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyErc20Retrieve(address indexed user, uint256 indexed pid, uuint256 amount);

    // Global variables
    // Start Block for the entire Idia staking ecosystem (to allow for staking to start at a fair time for everyone) 
    constructor(
        uint256 _startBlock,
    ) public {
        startBlock = _startBlock;
    }
// helpful to keep track of how many tracks there are. 
    function trackLength() external view returns (uint256) {
        return trackInfo.length;
    }

    // Section for track-creating features
    // Add a new asset to be staked. Can only be called by the owner.
    //  _stakeToken can be IDIA or an IDIA/IFUSD LP token, etc. Will start with majority of IDIA staking contracts first
    function add(IERC20 _stakeToken) public onlyOwner {
        uint256 latestRewardBlock = block.number > startBlock ? block.number : startBlock;
            // Update Pool Logic
        trackInfo.push(trackInfo({
            stakeToken: _stakeToken,
            latestRewardBlock: 0
            totalBalance: 0
        }));
    }
  
    // This function is only used as a View function to see pending idiaAge  on frontend.
    function checkPower(uint256 _trackId, address _user) external view returns (uint256) {
        trackInfo storage track = trackInfo[_trackId];
        // Need to check how much IDIA a user staked for each track
        userInfo storage user = userInfo[_trackId][_user][_track];
        uint256 accruedStakedPower = user.stakePower
        // if lastStake was < min stakePeriod ago


        uint256 totalIdiaSupplied = pool.stakeToken.balanceOf(address(this));
        if (block.number > pool.latestRewardBlock && totalIdiaSupplied != 0) {
            // TODO fix:
            accruedStakeWeight = accruedStakePower.add(idiaReward.mul(1e12).div(totalIdiaSupplied));
        }
        return user.amount.mul(accruedStakeAge).div(1e12).sub(user.rewardDebt);
    }

    // Section for user-facing creations

    // Increase staking
    // calculate global stake weight as a snapshot of what's "accrued"
    // The snapshot is essentially an "end time"

    // stake LP tokens to idiaIssuer to earn idia allocation via mining.
    // no changes from Sushi
    function stake(uint256 _trackId, uint256 _amount, uint256 _duration) external {
// TODO: Check if amount < user's max limit
        require(_amount >= 0, "stake too little");
        trackInfo storage pool = trackInfo[_trackId];
        userInfo storage user = userInfo[_trackId][msg.sender];
        // Update users most recent stake time.
        
            track.stakeToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        if(user.stakedAmount) {
            user.stakedAmount = user.stakedAmount.add(_amount);
            // Add calculation logic to update what the stakePower
        }
        else {
            user.stakedAmount = _amount;
            user.stakedPower = _amount;
        }
        user.rewardDebt = user.amount.mul(pool.accruedStakeAge).div(1e12);
        emit Stake(msg.sender, _trackId, _amount);
    }

// Can consider moving to a separate smart contract but harder to read that value if separately held onchain
    function privilegeddepositIFUSD(uint256 _trackId, uint256 _amount) external {
        
        // Based on the amount stakeed into a queue, how much stablecoin can be stakeed to claim allocation into the launchpad
        // require stakePower to be greater than min threshhold to claim some allocation
        // Check accruedReward
        // Calculate the accrued proportional allocation

    }
   // A unstake function 
    function unstake(uint256 _trackId, uint256 _amount, uint256 _duration) external {
        trackInfo storage pool = trackInfo[_trackId];
        userInfo storage user = userInfo[_trackId][msg.sender];
        require (user.stakedAmount > 0, 'no assets Staked');
        require(user.stakedAmount >= _amount, "unstaked too much");// To Ensure that user only withdrawas less than what they stakedIn
        
        if (_duration < 1) {
            require(block.number > user.lastDepositBlockStamp.add(1), "not ready to unstake"); //Prevent Flash loan attacks?
        }
        else {
        require(block.number > user.lastDepositBlockStamp.add(_duration), "not ready to unstake"); // Check that User's unlock time is ready
        }
        // Amount that can be claimed from the contract needs to be reduced by the amount redeemed
        //TODO: FIX if this is the name of the totalDeposited into a Track
        totalDeposited = totalDeposited.sub(_amount);
        poolsInfo[msg.sender]=poolsInfo[msg.sender].sub(_amount);
        idia.safeTransfer(address(msg.sender), _amount);
        emit Unstake(msg.sender, _trackId, _amount, _duration);
    }

// RollOver Function
    function refuseAllocation(uint256 _trackId, uint256 _amount) external {
        // roll over one's accrued staking for weight into the next launchpad in the category 
        // If not called, user receives a decay to their vote weight of 80% for each round they do not check in
        // This incentivises users to make sure they are systematic in checking in 
        // Easiest way would be to count as refreshing a timestamp that is saved to the user struct
        // so that future holdings can be counted from this time on. 
        // This encourages quick passing/refusal to give other users more of an idea of what allocation they may receive

        // record block.time for use 
    }


   function fundLaunchToken(uint256 _amount) public onlyOwner {

    // Somehow need to top up the contract to be able to support the trading of users' IFUSD for the project in question

    }

    // Only whitelisted addresse should be able to add tokens for sale should 
    function topUpAssetForSale() {
    // provide the contract with funds to be able to offer up for participants.


    }

    // Function for the multisig to cash in the accrued idia tokens for distribution into futher baskets of usage
    // Claiming ifUSD and later needs to assign it to governance multisig to distribute to project team during fundraise
    function cash() external onlyOwner {
        uint ifusdBal = ifusd.balanceOf(address(this));
        // Require the cash amount to be less than the amount totally deposited
        require(ifusd > 0, "not enough cash");
        // Split the _amount to be cashed out in half.
        ifusd.safeTransfer(address(msg.sender), ifusdBal);
        emit Cash(msg.sender, ifusdBal);
    }

    
    // Users may call this unstake without caring about rewards. EMERGENCY ONLY.
    // Accrued rewards are lost when this option is chosen.
    function emergencyUnstake(uint256 _trackId) external {
        trackInfo storage pool = trackInfo[_trackId];
        userInfo storage user = userInfo[_trackId][msg.sender];
        uint amount = user.amount;
        user.amount = 0;
        user.stakedPower = 0;
        idia.safeTransfer(address(msg.sender), amount);
        emit EmergencyUnstake(msg.sender, _trackId, amount);

    }

    // Safe idia transfer function, just in case if rounding error causes pool to not have enough idias.
    // Utilised by the pool itself (hence internal) to transfer funds to the miners.
    function safeidiaTransfer(address _to, uint256 _amount) internal {
        uint256 idiaBal = idia.balanceOf(address(this));
        if (_amount > idiaBal) {
            idia.transfer(_to, idiaBal);
        } else {
            idia.transfer(_to, _amount);
        }
    }

    // EMERGENCY ERC20 Rescue ONLY - unstake all erroneous sent in to this address. 
    // cannot unstake idia in the contract, this ensures that owner does not have a way to touch idia tokens 
    // in this contract inappropriately
    function emergencyErc20Retrieve(address token) external onlyOwner {
        require(token != address(idia)); // only allow retrieval for nonidia tokens
        IERC20(token).safeTransfer(address(msg.sender), IERC20(token).balanceOf(address(this))); // helps remove all 
        emit EmergencyErc20Retrieve(address(msg.sender), IERC20(token).balanceOf(address(this)));
    }
