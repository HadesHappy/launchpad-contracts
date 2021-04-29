//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

// IFStateMaster is responsible for persisting all launchpad state between project launches
// in order for the launches to have clean, self-enclosed, one-time-use states.

// IFStateMaster is the master of launchpad state. He can remember everything and he is a smart guy.
contract IFStateMaster is Ownable {
    using SafeERC20 for ERC20;

    // STRUCTS

    // A checkpoint for marking stake amount at a given block
    struct UserCheckpoint {
        uint256 blockNumber;
        uint256 staked;
        uint256 stakeWeight;
    }

    // A checkpoint for marking stake amount at a given block
    struct TrackCheckpoint {
        uint256 blockNumber;
        uint256 totalStaked;
        uint128 totalStakeWeight;
    }

    // Info of each pool.
    struct TrackInfo {
        // name of track
        string name;
        // token to stake (IDIA)
        ERC20 stakeToken;
        // weight accrual rate for this track (stake weight increase per block per stake token)
        uint256 weightAccrualRate;
        // counts number of sales within this track
        uint256 saleCounter;
        // total staked within this track
        uint256 totalStaked;
        // total stake weight within this track
        uint256 totalStakeWeight;
    }

    // TRACK INFO

    // array of track information
    TrackInfo[] internal tracks;

    // track checkpoint mapping -- (track, checkpoint number) => TrackCheckpoint
    mapping(uint256 => mapping(uint32 => TrackCheckpoint))
        public trackCheckpoints;

    // USER INFO

    // the number of checkpoints of a user for a track -- (track, user address) => checkpoint count
    mapping(uint256 => mapping(address => uint32)) public userCheckpointCounts;

    // user checkpoint mapping -- (track, user address, checkpoint number) => UserCheckpoint
    mapping(uint256 => mapping(address => mapping(uint32 => UserCheckpoint)))
        public userCheckpoints;

    // EVENTS

    event AddTrack(string indexed name, address indexed token);
    event SetTrackUserInfo(uint256 indexed trackId, address indexed user);
    event Stake(address indexed user, uint256 indexed trackId, uint256 amount);
    event Unstake(address indexed user, uint256 trackId, uint256 amount);
    event EmergencyUnstake(
        address indexed user,
        uint256 trackId,
        uint256 amount
    );

    // entrypoint
    constructor() {}

    // FUNCTIONS

    // number of tracks
    function trackCount() external view returns (uint256) {
        return tracks.length;
    }

    // adds a new track
    function addTrack(
        string calldata name,
        ERC20 stakeToken,
        uint256 _weightAccrualRate
    ) public onlyOwner {
        // add track
        tracks.push(
            TrackInfo({
                name: name, // name of track
                stakeToken: stakeToken, // token to stake (IDIA)
                weightAccrualRate: _weightAccrualRate, // rate of stake weight accrual
                saleCounter: 0, // default 0
                totalStaked: 0, // default 0
                totalStakeWeight: 0 // default 0
            })
        );

        // emit
        emit AddTrack(name, address(stakeToken));
    }

    // // get track info
    // function getTrack(uint256 trackId)
    //     public
    //     view
    //     returns (
    //         ERC20,
    //         uint256,
    //         uint256
    //     )
    // {
    //     // get track info
    //     TrackInfo storage track = tracks[trackId];
    //     // return track info
    //     return (track.stakeToken, track.saleCounter, track.totalStaked);
    // }

    // // sets info for a user of a particular track
    // function setTrackUserInfo(
    //     uint256 trackId,
    //     address user,
    //     TrackUserInfo calldata userInfo
    // ) public onlyOwner {
    //     // set user info
    //     users[trackId][user] = userInfo;

    //     // emit
    //     emit SetTrackUserInfo(trackId, user);
    // }

    // gets a user's stake weight within a track at a particular block number
    // logic extended from Compound COMP token `getPriorVotes` function
    function getStakeWeight(
        uint256 trackId,
        address user,
        uint256 blockNumber
    ) public view returns (uint256) {
        require(blockNumber <= block.number, 'block # too high');

        // check number of checkpoints
        uint32 nCheckpoints = userCheckpointCounts[trackId][msg.sender];
        if (nCheckpoints == 0) {
            return 0;
        }

        // closest checkpoint
        UserCheckpoint memory closestCheckpoint;

        if (
            userCheckpoints[trackId][user][nCheckpoints - 1].blockNumber <=
            blockNumber
        ) {
            // First check most recent checkpoint

            // set closest checkpoint
            closestCheckpoint = userCheckpoints[trackId][user][nCheckpoints - 1];
        }
        else if (userCheckpoints[trackId][user][0].blockNumber > blockNumber) {
            // Next check implicit zero balance

            return 0;
        } else {
            // binary search on checkpoints
            uint32 lower = 0;
            uint32 upper = nCheckpoints - 1;
            while (upper > lower) {
                uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
                UserCheckpoint memory cp = userCheckpoints[trackId][user][center];
                if (cp.blockNumber == blockNumber) {
                    return cp.stakeWeight;
                } else if (cp.blockNumber < blockNumber) {
                    lower = center;
                } else {
                    upper = center - 1;
                }
            }

            // get closest checkpoint
            closestCheckpoint = userCheckpoints[trackId][user][lower];
        }
        // calculate blocks elapsed since checkpoint
        uint256 additionalBlocks =
            (blockNumber - closestCheckpoint.blockNumber);

        // get track info
        TrackInfo storage trackInfo = tracks[trackId];

        // calculate marginal accrued stake weight
        uint256 marginalAccruedStakeWeight =
            additionalBlocks *
                trackInfo.weightAccrualRate *
                closestCheckpoint.staked / 10**18;


        console.log(block.number, closestCheckpoint.stakeWeight, '+', marginalAccruedStakeWeight);

        // return
        return closestCheckpoint.stakeWeight + marginalAccruedStakeWeight;
    }

    // stake
    function stake(uint256 trackId, uint256 amount) external {
        // stake amount must be greater than 0
        require(amount > 0, 'amount is 0');
        // TODO: stake amount must be <= user's limit

        // get track info
        TrackInfo storage track = tracks[trackId];

        // get number of user's checkpoints within this track
        uint32 userCheckpointCount = userCheckpointCounts[trackId][msg.sender];

        // transfer the specified amount of stake token from user to this contract
        track.stakeToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            amount
        );

        // branch depending on if this is user's first deposit
        if (userCheckpointCount == 0) {
            // add a new checkpoint for user within this track
            userCheckpoints[trackId][msg.sender][
                userCheckpointCount
            ] = UserCheckpoint({
                blockNumber: block.number,
                staked: amount,
                stakeWeight: 0
            });

            // console.log('---- adding checkpoint', userCheckpointCount, '----');
            // console.log('block', block.number);
            // console.log('staked', amount);
            // console.log('weight', 0);
            // console.log('----');
        } else {
            // get previous checkpoint
            UserCheckpoint storage prev =
                userCheckpoints[trackId][msg.sender][userCheckpointCount-1];

            // calculate blocks elapsed since checkpoint
            uint256 additionalBlocks = (block.number - prev.blockNumber);

            // calculate marginal accrued stake weight
            uint256 marginalAccruedStakeWeight =
                additionalBlocks * track.weightAccrualRate * prev.staked / 10**18;

            // add a new checkpoint for user within this track
            userCheckpoints[trackId][msg.sender][
                userCheckpointCount
            ] = UserCheckpoint({
                blockNumber: block.number,
                staked: prev.staked + amount,
                stakeWeight: prev.stakeWeight + marginalAccruedStakeWeight
            });

            // console.log('---- adding checkpoint', userCheckpointCount, '----');
            // console.log('block', block.number);
            // console.log('staked', prev.staked, '+', amount);
            // console.log('weight', prev.stakeWeight, '+', marginalAccruedStakeWeight);
            // console.log('----');
        }

        // increment user's checkpoint count
        userCheckpointCounts[trackId][msg.sender] = userCheckpointCount+1;

        // emit
        emit Stake(msg.sender, trackId, amount);
    }

    // // unstake
    // function unstake(
    //     uint256 trackId,
    //     uint256 amount,
    //     uint256 duration
    // ) external {
    //     // get track info
    //     SMLibrary.TrackInfo storage track = stateMaster.tracks[trackId];
    //     // get user info
    //     SMLibrary.UserInfo storage user =
    //         stateMaster.users[trackId][msg.sender];

    //     // existing stake must be > 0 to unstake
    //     require(user.stakeAmount > 0, 'no assets staked');
    //     // amount to unstake must be <= stake amount
    //     require(user.stakeAmount > amount, 'unstaking too much');

    //     // duration checks
    //     if (duration < 1) {
    //         require(
    //             block.number > user.lastDepositBlockStamp.add(1),
    //             'not ready to unstake'
    //         ); //Prevent Flash loan attacks?
    //     } else {
    //         require(
    //             block.number > user.lastDepositBlockStamp.add(duration),
    //             'not ready to unstake'
    //         ); // Check that User's unlock time is ready
    //     }

    //     // TODO: Amount that can be claimed from the contract needs to be reduced by the amount redeemed
    //     // TODO: FIX if this is the name of the totalDeposit into a Track
    //     user.totalDeposit = user.totalDeposit.sub(amount);

    //     // update user info with decreased amount
    //     user.stakeAmount = user.stakeAmount.sub(amount);
    //     // transfer _amount from user wallet to this contract
    //     idia.safeTransfer(address(msg.sender), amount);

    //     // emit
    //     emit Unstake(msg.sender, trackId, amount, duration);
    // }

    // // Users may call this unstake without caring about rewards. EMERGENCY ONLY.
    // // Accrued rewards are lost when this option is chosen.
    // function emergencyUnstake(uint256 _trackId) external {
    //     // get user info
    //     SMLibrary.UserInfo storage user =
    //         stateMaster.users[_trackId][msg.sender];
    //     // get user amount
    //     uint256 amount = user.amount;

    //     // reduce recorded user amount and stake power to 0
    //     user.amount = 0;
    //     user.stakePower = 0;

    //     // transfer out
    //     idia.safeTransfer(address(msg.sender), amount);

    //     // emit
    //     emit EmergencyUnstake(msg.sender, _trackId, amount);
    // }
}
