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
    TrackInfo[] public tracks;

    // the number of checkpoints of a track -- (track, user address) => checkpoint count
    // mapping(uint256 => mapping(address => uint32)) public trackCheckpointCounts;

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
    event Unstake(address indexed user, uint256 indexed trackId, uint256 amount);
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

        // add a new checkpoint for this track
        trackCheckpoints[trackId][userCheckpointCount] = TrackCheckpoint({
            blockNumber: block.number,
            staked: amount,
            stakeWeight: 0
        });

        // emit
        emit AddTrack(name, address(stakeToken));
    }

    // gets a user's stake weight within a track at a particular block number
    // logic extended from Compound COMP token `getPriorVotes` function
    function getUserStakeWeight(
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

        // declare closest checkpoint
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
            // Next check earliest checkpoint

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

        // debug
        console.log(block.number, closestCheckpoint.stakeWeight, '+', marginalAccruedStakeWeight);

        // return
        return closestCheckpoint.stakeWeight + marginalAccruedStakeWeight;
    }

    // gets total stake weight within a track at a particular block number
    // logic extended from Compound COMP token `getPriorVotes` function
    function getTotalStakeWeight(uint256 trackId, uint256 blockNumber) public view returns (uint256) {
        require(blockNumber <= block.number, 'block # too high');

        // number of checkpoints
        uint32 nCheckpoints = uint32(tracks.length);

        // declare closest checkpoint
        TrackCheckpoint memory closestCheckpoint;

        if (
            trackCheckpoints[trackId][nCheckpoints - 1].blockNumber <=
            blockNumber
        ) {
            // First check most recent checkpoint

            // set closest checkpoint
            closestCheckpoint = trackCheckpoints[trackId][nCheckpoints - 1];
        }
        else if (trackCheckpoints[trackId][0].blockNumber > blockNumber) {
            // Next check earliest checkpoint

            return 0;
        } else {
            // binary search on checkpoints
            uint32 lower = 0;
            uint32 upper = nCheckpoints - 1;
            while (upper > lower) {
                uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
                TrackCheckpoint memory cp = trackCheckpoints[trackId][center];
                if (cp.blockNumber == blockNumber) {
                    return cp.totalStakeWeight;
                } else if (cp.blockNumber < blockNumber) {
                    lower = center;
                } else {
                    upper = center - 1;
                }
            }

            // get closest checkpoint
            closestCheckpoint = trackCheckpoints[trackId][lower];
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
                closestCheckpoint.totalStaked / 10**18;

        // debug
        console.log(block.number, closestCheckpoint.totalStakeWeight, '+', marginalAccruedStakeWeight);

        // return
        return closestCheckpoint.totalStakeWeight + marginalAccruedStakeWeight;
    }

    function getAccruedStakeWeight(uint256 blocksElapsed, uint256 accrualRate, uint256 staked) pure external returns (uint256) {
        // calculate marginal accrued stake weight
        return blocksElapsed * accrualRate * staked / 10**18;
    }

    // function addUserCheckpoint() {
    //     require
    // }

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

            // console.log('---- adding checkpoint', userCheckpointCount, '(stake) ----');
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

            // console.log('---- adding checkpoint', userCheckpointCount, '(stake) ----');
            // console.log('block', block.number);
            // console.log('staked', prev.staked, '+', amount);
            // console.log('weight', prev.stakeWeight, '+', marginalAccruedStakeWeight);
            // console.log('----');
        }

        // increment user's checkpoint count
        userCheckpointCounts[trackId][msg.sender] = userCheckpointCount+1;
        
        // update Track total staked
        track.totalStaked += amount;
        
        // emit
        emit Stake(msg.sender, trackId, amount);
    }

    // unstake
    function unstake(
        uint256 trackId,
        uint256 amount
    ) external {
        // amount must be greater than 0
        require(amount > 0, 'amount is 0');

        // get track info
        TrackInfo storage track = tracks[trackId];

        // get number of user's checkpoints within this track
        uint32 userCheckpointCount = userCheckpointCounts[trackId][msg.sender];

        // get user's latest checkpoint
        UserCheckpoint storage checkpoint = userCheckpoints[trackId][msg.sender][
                userCheckpointCount-1
            ];

        // ensure amount <= user's current stake
        require(amount <= checkpoint.staked, 'amount > staked');

        // cannot unstake within same block of stake
        if (block.number == checkpoint.blockNumber) {
            revert('unstake too soon');
        }

        // transfer the specified amount of stake token from this contract to user
        track.stakeToken.safeTransfer(
            address(msg.sender),
            amount
        );

        // calculate blocks elapsed since checkpoint
        uint256 additionalBlocks =
            (block.number - checkpoint.blockNumber);

        // calculate marginal accrued stake weight
        uint256 marginalAccruedStakeWeight =
            additionalBlocks * track.weightAccrualRate * checkpoint.staked / 10**18;

        console.log('---- adding checkpoint', userCheckpointCount, '(unstake) ----');
        console.log('block', block.number);
        console.log('staked', checkpoint.staked, '-', amount);
        console.log('weight', checkpoint.stakeWeight, '+', marginalAccruedStakeWeight);
        console.log('----');

        // add a new checkpoint for user within this track
        userCheckpoints[trackId][msg.sender][
            userCheckpointCount
        ] = UserCheckpoint({
            blockNumber: block.number,
            staked: checkpoint.staked - amount,
            stakeWeight: checkpoint.stakeWeight + marginalAccruedStakeWeight
        });

        // increment user's checkpoint count
        userCheckpointCounts[trackId][msg.sender] = userCheckpointCount+1;

        // // todo: cannot unstake within min duration
        // if (checkpoint.blockNumber + minDuration < block.number) {
        //     revert('not ready to unstake');
        // }

        // update Track total staked
        track.totalStaked -= amount;

        // TODO: add Track checkpoint
        // struct TrackCheckpoint {
        //     uint256 blockNumber;
        //     uint256 totalStaked;
        //     uint128 totalStakeWeight;
        // }

        // emit
        emit Unstake(msg.sender, trackId, amount);
    }

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
