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

    // A checkpoint for marking stake amount at a given block
    struct StakeCheckpoint {
        uint256 blockNumber;
        uint256 staked;
        uint128 stakeWeight;
    }

    // Information of a user with respect to a specific track.
    struct TrackUserInfo {
        // the amount a user has staked for a track
        uint256 staked;
        // the number of checkpoints of a user for a track
        uint32 numCheckpoints;
    }

    // Info of each pool.
    struct TrackInfo {
        // name of track
        string name;
        // token to stake (IDIA)
        ERC20 stakeToken;
        // counts number of sales within this track
        uint256 saleCounter;
        // total staked within this track
        uint256 totalStaked;
        // total stake weight within this track
        uint256 totalStakeWeight;
    }

    // array of track information
    TrackInfo[] internal tracks;

    // checkpoint mapping -- (track, user address, checkpoint number) => StakeCheckpoint
    mapping(uint256 => mapping (address => mapping (uint32 => StakeCheckpoint))) public checkpoints;

    // user info mapping -- (track, user address) => user info
    mapping(uint256 => mapping(address => TrackUserInfo))
        public users;

    // events
    event AddTrack(string indexed name, address indexed token);
    event SetTrackUserInfo(uint256 indexed trackId, address indexed user);

    constructor() {}

    // number of tracks
    function trackCount() external view returns (uint256) {
        return tracks.length;
    }

    // adds a new track
    function addTrack(string calldata name, ERC20 stakeToken) public onlyOwner {
        // add track
        tracks.push(
            TrackInfo({
                name: name, // name of track
                stakeToken: stakeToken, // token to stake (IDIA)
                saleCounter: 0, // default 0
                totalStaked: 0, // default 0
                totalStakeWeight:0 // default 0
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

    // sets info for a user of a particular track
    function setTrackUserInfo(
        uint256 trackId,
        address user,
        TrackUserInfo calldata userInfo
    ) public onlyOwner {
        // set user info
        users[trackId][user] = userInfo;

        // emit
        emit SetTrackUserInfo(trackId, user);
    }

    // gets a user's stake weight within a track at a particular block number
    // logic extended from Compound COMP token `getPriorVotes` function
    function getStakeWeight(uint256 trackId, address user, uint blockNumber) public view returns (uint256) {
        require(blockNumber < block.number, "block # too high");

        // get user info
        TrackUserInfo storage userInfo = users[trackId][msg.sender];

        // check number of checkpoints
        uint32 nCheckpoints = userInfo.numCheckpoints;
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent checkpoint
        if (checkpoints[trackId][user][nCheckpoints - 1].blockNumber <= blockNumber) {
            return checkpoints[trackId][user][nCheckpoints - 1].stakeWeight;
        }

        // Next check implicit zero balance
        if (checkpoints[trackId][user][0].blockNumber > blockNumber) {
            return 0;
        }

        // binary search on checkpoints
        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            StakeCheckpoint memory cp = checkpoints[trackId][user][center];
            if (cp.blockNumber == blockNumber) {
                return cp.stakeWeight;
            } else if (cp.blockNumber < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[trackId][user][lower].stakeWeight;

    }

    // stake

    // unstake


}
