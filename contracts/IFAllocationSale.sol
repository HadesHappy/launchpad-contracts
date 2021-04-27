// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IFStateMaster.sol';

contract IFAllocationSale is Ownable {
    using SafeERC20 for ERC20;

    // tokens
    ERC20 public ifusd;
    ERC20 public idia;

    // start block when sale is active (inclusive)
    uint256 public startBlock;
    // end block when sale is active (inclusive)
    uint256 public endBlock;
    // allocation snapshot block
    uint256 public allocSnapshotBlock;
    // min for deposits, to ensure that every track has some liquidity in the long run
    uint256 public minDeposit;
    // max for deposits, where penalty may be levied later on
    uint256 public maxDeposit;

    IFStateMaster stateMaster;

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
        IFStateMaster _stateMaster,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _allocSnapshotBlock,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        ERC20 _ifusd,
        ERC20 _idia
    ) {
        stateMaster = _stateMaster;
        startBlock = _startBlock;
        endBlock = _endBlock;
        allocSnapshotBlock = _allocSnapshotBlock;
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        ifusd = _ifusd;
        idia = _idia;
    }

    // stake
    function stake(
        uint256 trackId,
        uint256 amount,
        uint256 duration
    ) external {
        // stake amount must be greater than 0
        require(amount > 0, 'amount is 0');
        // TODO: stake amount must be <= user's balance AND limit

        // user can only stake if sale is active
        require(block.number < startBlock, 'too early');
        require(block.number > endBlock, 'too late');

        // get track info
        SMLibrary.TrackInfo storage track = stateMaster.tracks[trackId];
        // get user info
        SMLibrary.UserInfo storage user =
            stateMaster.users[trackId][msg.sender];

        // TODO: Update users most recent stake time.

        // transfer the specified amount of stake token from user to this contract
        track.stakeToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            amount
        );

        // update tracked stake amount and stake power in user info
        if (user.stakeAmount) {
            user.stakeAmount = user.stakeAmount.add(amount);
            // TODO: Add calculation logic to update stakePower
        } else {
            user.stakeAmount = amount;
            user.stakePower = amount;
        }

        //
        user.rewardDebt = user.amount.mul(track.accruedStakeAge).div(1e12);

        // emit
        emit Stake(msg.sender, trackId, amount);
    }

    // unstake
    function unstake(
        uint256 trackId,
        uint256 amount,
        uint256 duration
    ) external {
        // get track info
        SMLibrary.TrackInfo storage track = stateMaster.tracks[trackId];
        // get user info
        SMLibrary.UserInfo storage user =
            stateMaster.users[trackId][msg.sender];

        // existing stake must be > 0 to unstake
        require(user.stakeAmount > 0, 'no assets staked');
        // amount to unstake must be <= stake amount
        require(user.stakeAmount > amount, 'unstaking too much');

        // duration checks
        if (duration < 1) {
            require(
                block.number > user.lastDepositBlockStamp.add(1),
                'not ready to unstake'
            ); //Prevent Flash loan attacks?
        } else {
            require(
                block.number > user.lastDepositBlockStamp.add(duration),
                'not ready to unstake'
            ); // Check that User's unlock time is ready
        }

        // TODO: Amount that can be claimed from the contract needs to be reduced by the amount redeemed
        // TODO: FIX if this is the name of the totalDeposit into a Track
        user.totalDeposit = user.totalDeposit.sub(amount);

        // update user info with decreased amount
        user.stakeAmount = user.stakeAmount.sub(amount);
        // transfer _amount from user wallet to this contract
        idia.safeTransfer(address(msg.sender), amount);

        // emit
        emit Unstake(msg.sender, trackId, amount, duration);
    }

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
