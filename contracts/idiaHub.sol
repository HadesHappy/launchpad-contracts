// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// TODO: QUICK EXPLAINER

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './StateMaster.sol';

// import './idiaToken.sol'; // TODO: need to add new .sol file for whatever we launch of the idia token

contract IDIAHub is Ownable {
    using SafeERC20 for ERC20;

    // tokens
    ERC20 public ifusd;
    ERC20 public idia;

    // start block when sale is active (inclusive)
    uint256 public startBlock;
    // end block when sale is active (inclusive)
    uint256 public endBlock;
    // min for deposits, to ensure that every track has some liquidity in the long run
    uint256 public minDeposit;
    // max for deposits, where penalty may be levied later on
    uint256 public maxDeposit;

    StateMaster stateMaster;

    // events
    event Cash(address indexed sender, uint256 balance);
    event Stake(
        address indexed user,
        uint256 indexed pid,
        uint256 trackId,
        uint256 amount
    );
    event Unstake(
        address indexed user,
        uint256 indexed pid,
        uint256 trackId,
        uint256 amount
    );
    event EmergencyUnstake(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event EmergencyErc20Retrieve(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    // entrypoint
    constructor(
        StateMaster _stateMaster,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        ERC20 _ifusd,
        ERC20 _idia
    ) public {
        stateMaster = _stateMaster;
        startBlock = _startBlock;
        endBlock = _endBlock;
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        ifusd = _ifusd;
        idia = _idia;
    }

    // view function to see pending idiaAge on frontend.
    function checkPower(uint256 _trackId, address _user)
        external
        view
        returns (uint256)
    {
        SMLibrary.TrackInfo storage track = stateMaster.tracks[_trackId];
        // TODO: check how much IDIA a user staked for each track
        SMLibrary.UserInfo storage user =
            stateMaster.users[_trackId][_user][track];
        uint256 accruedStakePower = user.stakePower;
        // if lastStake was < min stakePeriod ago

        uint256 totalIdiaSupplied = track.stakeToken.balanceOf(address(this));
        if (block.number > track.latestRewardBlock && totalIdiaSupplied != 0) {
            // TODO fix:
            accruedStakeWeight = accruedStakePower.add(
                idiaReward.mul(1e12).div(totalIdiaSupplied)
            );
        }
        return user.amount.mul(accruedStakeAge).div(1e12).sub(user.rewardDebt);
    }

    // Section for user-facing creations

    // Increase staking
    // calculate global stake weight as a snapshot of what's "accrued"
    // The snapshot is essentially an "end time"

    // stake LP tokens to idiaIssuer to earn idia allocation via mining.
    // no changes from Sushi
    function stake(
        uint256 _trackId,
        uint256 _amount,
        uint256 _duration
    ) external {
        // stake amount must be greater than 0
        require(_amount > 0, 'amount is 0');
        // TODO: stake amount must be <= user's balance AND limit

        // user can only stake if sale is active
        require(block.number < startBlock, 'too early');
        require(block.number > endBlock, 'too late');

        // get track info
        SMLibrary.TrackInfo storage track = stateMaster.tracks[_trackId];
        // get user info
        SMLibrary.UserInfo storage user =
            stateMaster.users[_trackId][msg.sender];

        // TODO: Update users most recent stake time.

        // transfer the specified amount of stake token from user to this contract
        track.stakeToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );

        // update tracked stake amount and stake power in user info
        if (user.stakeAmount) {
            user.stakeAmount = user.stakeAmount.add(_amount);
            // TODO: Add calculation logic to update stakePower
        } else {
            user.stakeAmount = _amount;
            user.stakePower = _amount;
        }

        //
        user.rewardDebt = user.amount.mul(track.accruedStakeAge).div(1e12);

        // emit
        emit Stake(msg.sender, _trackId, _amount);
    }

    // TODO: consider moving to a separate smart contract but harder to read that value if separately held onchain
    function privilegeddepositIFUSD(uint256 _trackId, uint256 _amount)
        external
    {
        // TODO:
        // Based on the amount staked into a queue, how much stablecoin can be staked to claim allocation into the launchpad
        // require stakePower to be greater than min threshhold to claim some allocation
        // Check accruedReward
        // Calculate the accrued proportional allocation
    }

    // unstake tokens
    function unstake(
        uint256 _trackId,
        uint256 _amount,
        uint256 _duration
    ) external {
        // get track info
        SMLibrary.TrackInfo storage track = stateMaster.tracks[_trackId];
        // get user info
        SMLibrary.UserInfo storage user =
            stateMaster.users[_trackId][msg.sender];

        // existing stake must be > 0 to unstake
        require(user.stakeAmount > 0, 'no assets staked');
        // amount to unstake must be <= stake amount
        require(user.stakeAmount > _amount, 'unstaking too much');

        // duration checks
        if (_duration < 1) {
            require(
                block.number > user.lastDepositBlockStamp.add(1),
                'not ready to unstake'
            ); //Prevent Flash loan attacks?
        } else {
            require(
                block.number > user.lastDepositBlockStamp.add(_duration),
                'not ready to unstake'
            ); // Check that User's unlock time is ready
        }

        // TODO: Amount that can be claimed from the contract needs to be reduced by the amount redeemed
        // TODO: FIX if this is the name of the totalDeposited into a Track
        totalDeposited = totalDeposited.sub(_amount);

        // update user info with decreased amount
        user.stakeAmount = user.stakeAmount.sub(_amount);
        // transfer _amount from user wallet to this contract
        idia.safeTransfer(address(msg.sender), _amount);

        // emit
        emit Unstake(msg.sender, _trackId, _amount, _duration);
    }

    // TODO: RollOver Function
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
        // TODO: Somehow need to top up the contract to be able to support the trading of users' IFUSD for the project in question
    }

    //// Only whitelisted address should be able to add tokens for sale
    // function topUpAssetForSale() {
    //     // provide the contract with funds to be able to offer up for participants.
    // }

    // Function for the multisig to cash in the accrued idia tokens for distribution into futher baskets of usage
    // Claiming ifUSD and later needs to assign it to governance multisig to distribute to project team during fundraise
    function cash() external onlyOwner {
        uint256 ifusdBal = ifusd.balanceOf(address(this));
        // Require the cash amount to be less than the amount totally deposited
        require(ifusdBal > 0, 'not enough cash');
        // Split the _amount to be cashed out in half.
        ifusd.safeTransfer(address(msg.sender), ifusdBal);

        // emit
        emit Cash(msg.sender, ifusdBal);
    }

    // Users may call this unstake without caring about rewards. EMERGENCY ONLY.
    // Accrued rewards are lost when this option is chosen.
    function emergencyUnstake(uint256 _trackId) external {
        // get user info
        SMLibrary.UserInfo storage user =
            stateMaster.users[_trackId][msg.sender];
        // get user amount
        uint256 amount = user.amount;

        // reduce recorded user amount and stake power to 0
        user.amount = 0;
        user.stakePower = 0;

        // transfer out
        idia.safeTransfer(address(msg.sender), amount);

        // emit
        emit EmergencyUnstake(msg.sender, _trackId, amount);
    }

    // EMERGENCY ERC20 Rescue ONLY - unstake all erroneous sent in to this address.
    // cannot unstake idia in the contract, this ensures that owner does not have a way to touch idia tokens
    // in this contract inappropriately
    function emergencyErc20Retrieve(address token) external onlyOwner {
        require(token != address(idia)); // only allow retrieval for nonidia tokens
        ERC20(token).safeTransfer(
            address(msg.sender),
            ERC20(token).balanceOf(address(this))
        ); // helps remove all
        emit EmergencyErc20Retrieve(
            address(msg.sender),
            ERC20(token).balanceOf(address(this))
        );
    }
}
