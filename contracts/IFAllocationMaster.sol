//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

// IFAllocationMaster is responsible for persisting all launchpad state between project token sales
// in order for the sales to have clean, self-enclosed, one-time-use states.

// IFAllocationMaster is the master of allocations. He can remember everything and he is a smart guy.
contract IFAllocationMaster is Ownable {
    using SafeERC20 for ERC20;

    // STRUCTS

    // A checkpoint for marking stake info at a given block
    struct UserCheckpoint {
        // block number of checkpoint
        uint256 blockNumber;
        // amount staked at checkpoint
        uint256 staked;
        // amount of stake weight at checkpoint
        uint256 stakeWeight;
    }

    // A checkpoint for marking stake info at a given block
    struct TrackCheckpoint {
        // block number of checkpoint
        uint256 blockNumber;
        // amount staked at checkpoint
        uint256 totalStaked;
        // amount of stake weight at checkpoint
        uint256 totalStakeWeight;
        // whether track is disabled (once disabled, cannot undo)
        bool disabled;
        // counts number of sales within this track
        uint24 saleCounter;
    }

    // Info of each track. These parameters cannot be changed.
    struct TrackInfo {
        // name of track
        string name;
        // token to stake (IDIA)
        ERC20 stakeToken;
        // weight accrual rate for this track (stake weight increase per block per stake token)
        uint80 weightAccrualRate;
    }

    // TRACK INFO

    // array of track information
    TrackInfo[] public tracks;

    // the number of checkpoints of a track -- (track) => checkpoint count
    mapping(uint256 => uint32) public trackCheckpointCounts;

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
    event DisableTrack(uint256 indexed trackId);
    event BumpSaleCounter(uint256 indexed trackId, uint32 newCount);
    event AddUserCheckpoint(uint256 blockNumber, uint256 indexed trackId);
    event AddTrackCheckpoint(uint256 blockNumber, uint256 indexed trackId);
    event Stake(address indexed user, uint256 indexed trackId, uint256 amount);
    event Unstake(
        address indexed user,
        uint256 indexed trackId,
        uint256 amount
    );

    // CONSTRUCTOR

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
        uint80 _weightAccrualRate
    ) public onlyOwner {
        // add track
        tracks.push(
            TrackInfo({
                name: name, // name of track
                stakeToken: stakeToken, // token to stake (e.g., IDIA)
                weightAccrualRate: _weightAccrualRate // rate of stake weight accrual
            })
        );

        // add first track checkpoint
        addTrackCheckpoint(
            tracks.length - 1, // latest track
            0, // initialize with 0 stake
            false, // add or sub does not matter
            false, // initialize as not disabled
            false // do not bump sale counter
        );

        // emit
        emit AddTrack(name, address(stakeToken));
    }

    // bumps a track's sale counter
    function bumpSaleCounter(uint256 trackId) public onlyOwner {
        // add a new checkpoint with saleCounter incremented by 1
        addTrackCheckpoint(trackId, 0, false, false, true);

        // `BumpSaleCounter` event emitted in function call above
    }

    // disables a track
    function disableTrack(uint256 trackId) public onlyOwner {
        // add a new checkpoint with `disabled` set to true
        addTrackCheckpoint(trackId, 0, false, true, false);

        // `DisableTrack` event emitted in function call above
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
        uint32 nCheckpoints = userCheckpointCounts[trackId][user];
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
            closestCheckpoint = userCheckpoints[trackId][user][
                nCheckpoints - 1
            ];
        } else if (
            userCheckpoints[trackId][user][0].blockNumber > blockNumber
        ) {
            // Next check earliest checkpoint

            return 0;
        } else {
            // binary search on checkpoints
            uint32 lower = 0;
            uint32 upper = nCheckpoints - 1;
            while (upper > lower) {
                uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
                UserCheckpoint memory cp =
                    userCheckpoints[trackId][user][center];
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
            (additionalBlocks *
                trackInfo.weightAccrualRate *
                closestCheckpoint.staked) / 10**18;

        // debug
        // console.log('user stake weight');
        // console.log(
        //     block.number,
        //     closestCheckpoint.stakeWeight,
        //     '+',
        //     marginalAccruedStakeWeight
        // );

        // return
        return closestCheckpoint.stakeWeight + marginalAccruedStakeWeight;
    }

    // gets total stake weight within a track at a particular block number
    // logic extended from Compound COMP token `getPriorVotes` function
    function getTotalStakeWeight(uint256 trackId, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        require(blockNumber <= block.number, 'block # too high');

        // number of checkpoints
        uint32 nCheckpoints = trackCheckpointCounts[trackId];

        // declare closest checkpoint
        TrackCheckpoint memory closestCheckpoint;

        if (
            trackCheckpoints[trackId][nCheckpoints - 1].blockNumber <=
            blockNumber
        ) {
            // First check most recent checkpoint

            // set closest checkpoint
            closestCheckpoint = trackCheckpoints[trackId][nCheckpoints - 1];
        } else if (trackCheckpoints[trackId][0].blockNumber > blockNumber) {
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
            (additionalBlocks *
                trackInfo.weightAccrualRate *
                closestCheckpoint.totalStaked) / 10**18;

        // debug
        // console.log('total stake weight');
        // console.log(
        //     block.number,
        //     closestCheckpoint.totalStakeWeight,
        //     '+',
        //     marginalAccruedStakeWeight
        // );

        // return
        return closestCheckpoint.totalStakeWeight + marginalAccruedStakeWeight;
    }

    function addUserCheckpoint(
        uint256 trackId,
        uint256 amount,
        bool addElseSub
    ) internal {
        // get track info
        TrackInfo storage track = tracks[trackId];

        // get user checkpoint count
        uint32 nCheckpoints = userCheckpointCounts[trackId][_msgSender()];

        // if this is first checkpoint
        if (nCheckpoints == 0) {
            // console.log(
            //     '---- adding user checkpoint',
            //     nCheckpoints,
            //     '(stake) ----'
            // );
            // console.log('block', block.number);
            // console.log('staked', amount);
            // console.log('weight', 0);
            // console.log('----');

            // add a first checkpoint for this user on this track
            userCheckpoints[trackId][_msgSender()][0] = UserCheckpoint({
                blockNumber: block.number,
                staked: amount,
                stakeWeight: 0
            });
        } else {
            // get previous checkpoint
            UserCheckpoint storage prev =
                userCheckpoints[trackId][_msgSender()][nCheckpoints - 1];

            // calculate blocks elapsed since checkpoint
            uint256 additionalBlocks = (block.number - prev.blockNumber);

            // calculate marginal accrued stake weight
            uint256 marginalAccruedStakeWeight =
                (additionalBlocks * track.weightAccrualRate * prev.staked) /
                    10**18;

            // add a new checkpoint for user within this track
            userCheckpoints[trackId][_msgSender()][
                nCheckpoints
            ] = UserCheckpoint({
                blockNumber: block.number,
                staked: addElseSub
                    ? prev.staked + amount
                    : prev.staked - amount,
                stakeWeight: prev.stakeWeight + marginalAccruedStakeWeight
            });

            // console.log(
            //     '---- adding user checkpoint',
            //     nCheckpoints,
            //     '(stake) ----'
            // );
            // console.log('block', block.number);
            // console.log('staked', prev.staked, '+', amount);
            // console.log(
            //     'weight',
            //     prev.stakeWeight,
            //     addElseSub ? '+' : '-',
            //     marginalAccruedStakeWeight
            // );
            // console.log('----');
        }

        // increment user's checkpoint count
        userCheckpointCounts[trackId][_msgSender()] = nCheckpoints + 1;

        // emit
        emit AddUserCheckpoint(block.number, trackId);
    }

    function addTrackCheckpoint(
        uint256 trackId, // track number
        uint256 amount, // delta on staked amount
        bool addElseSub, // true = adding; false = subtracting
        bool disabled, // whether track is disabled; cannot undo a disable
        bool _bumpSaleCounter // whether to increase sale counter by 1
    ) internal {
        // get track info
        TrackInfo storage track = tracks[trackId];

        // get track checkpoint count
        uint32 nCheckpoints = trackCheckpointCounts[trackId];

        // if this is first checkpoint
        if (nCheckpoints == 0) {
            // add a first checkpoint for this track
            trackCheckpoints[trackId][0] = TrackCheckpoint({
                blockNumber: block.number,
                totalStaked: amount,
                totalStakeWeight: 0,
                disabled: disabled,
                saleCounter: _bumpSaleCounter ? 1 : 0
            });

            // console.log('---- adding track checkpoint', nCheckpoints, ' ----');
            // console.log('block', block.number);
            // console.log('total staked', amount);
            // console.log('total weight', 0);
            // console.log('----');
        } else {
            // get previous checkpoint
            TrackCheckpoint storage prev =
                trackCheckpoints[trackId][nCheckpoints - 1];

            // calculate blocks elapsed since checkpoint
            uint256 additionalBlocks = (block.number - prev.blockNumber);

            // calculate marginal accrued stake weight
            uint256 marginalAccruedStakeWeight =
                (additionalBlocks *
                    track.weightAccrualRate *
                    prev.totalStaked) / 10**18;

            // console.log('---- adding track checkpoint', nCheckpoints, ' ----');
            // console.log('block', block.number);
            // console.log(
            //     'total staked',
            //     prev.totalStaked,
            //     addElseSub ? '+' : '-',
            //     amount
            // );
            // console.log(
            //     'total weight',
            //     prev.totalStakeWeight,
            //     '+',
            //     marginalAccruedStakeWeight
            // );
            // console.log('----');

            // add a new checkpoint for this track
            if (prev.disabled) {
                // if previous checkpoint was disabled, then total staked can only decrease
                require(addElseSub == false, 'disabled track can only sub');
                // if previous checkpoint was disabled, then disabled cannot be false going forward
                require(disabled == true, 'cannot undo disable');

                // if previous checkpoint was disabled, stakeweight cannot increase
                // and new checkpoint must also be disabled
                trackCheckpoints[trackId][nCheckpoints] = TrackCheckpoint({
                    blockNumber: block.number,
                    totalStaked: prev.totalStaked - amount,
                    totalStakeWeight: prev.totalStakeWeight,
                    disabled: true,
                    saleCounter: prev.saleCounter
                });
            } else {
                trackCheckpoints[trackId][nCheckpoints] = TrackCheckpoint({
                    blockNumber: block.number,
                    totalStaked: addElseSub
                        ? prev.totalStaked + amount
                        : prev.totalStaked - amount,
                    totalStakeWeight: prev.totalStakeWeight +
                        marginalAccruedStakeWeight,
                    disabled: disabled,
                    saleCounter: _bumpSaleCounter
                        ? prev.saleCounter + 1
                        : prev.saleCounter
                });

                // emit
                if (_bumpSaleCounter) {
                    emit BumpSaleCounter(trackId, prev.saleCounter + 1);
                }
                if (disabled) {
                    emit DisableTrack(trackId);
                }
            }
        }

        // increase new track's checkpoint count by 1
        trackCheckpointCounts[trackId]++;

        // emit
        emit AddTrackCheckpoint(block.number, trackId);
    }

    // stake
    function stake(uint256 trackId, uint256 amount) external {
        // stake amount must be greater than 0
        require(amount > 0, 'amount is 0');

        // get track info
        TrackInfo storage track = tracks[trackId];

        // get latest track checkpoint
        TrackCheckpoint storage checkpoint =
            trackCheckpoints[trackId][trackCheckpointCounts[trackId]];

        // cannot stake into disabled track
        require(!checkpoint.disabled, 'track is disabled');

        // transfer the specified amount of stake token from user to this contract
        track.stakeToken.safeTransferFrom(_msgSender(), address(this), amount);

        // add user checkpoint
        addUserCheckpoint(trackId, amount, true);

        // add track checkpoint
        addTrackCheckpoint(trackId, amount, true, false, false);

        // emit
        emit Stake(_msgSender(), trackId, amount);
    }

    // unstake
    function unstake(uint256 trackId, uint256 amount) external {
        // amount must be greater than 0
        require(amount > 0, 'amount is 0');

        // get track info
        TrackInfo storage track = tracks[trackId];

        // get number of user's checkpoints within this track
        uint32 userCheckpointCount =
            userCheckpointCounts[trackId][_msgSender()];

        // get user's latest checkpoint
        UserCheckpoint storage checkpoint =
            userCheckpoints[trackId][_msgSender()][userCheckpointCount - 1];

        // ensure amount <= user's current stake
        require(amount <= checkpoint.staked, 'amount > staked');

        // transfer the specified amount of stake token from this contract to user
        track.stakeToken.safeTransfer(_msgSender(), amount);

        // add user checkpoint
        addUserCheckpoint(trackId, amount, false);

        // add track checkpoint
        addTrackCheckpoint(trackId, amount, false, false, false);

        // emit
        emit Unstake(_msgSender(), trackId, amount);
    }
}
