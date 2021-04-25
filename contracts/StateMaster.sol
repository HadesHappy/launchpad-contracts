//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import 'hardhat/console.sol';

// StateMaster is responsible for persisting all launchpad state between project launches
// in order for the launches to have clean, self-enclosed, one-time-use states.

// Library of datastructures used by StateMaster and IDIAHub
library SMLibrary {
    // TODO: make sure the structure is proper such that userInfo is contained within a trackInfo
    // TODO: update both amount deposited and accruedStakeAge every time a deposit or withdraw happens
    // Info of each user.
    struct UserInfo {
        // How many IDIA tokens the user has provided to a given track
        uint256 stakeAmount;
        // How to let users stake multiple durations? force them to stake into discrete staking options?
        // where options 1-4 could be weeks, months, years etc. for a multiplier on power.
        uint256 stakeDuration;
        // the calculated weight of the user's proportion
        uint256 stakePower;
        // records the time of last deposit to properly calculate stake age
        uint256 lastDepositBlockStamp;
    }

    // Info of each pool.
    struct TrackInfo {
        // token to stake
        ERC20 stakeToken;
        // last time a launchpad took place in this track
        uint256 lastCampaignTime;
        // Tracker of the total deposits within a pool, starts at 0.
        uint256 totalDeposit;
        // TODO: decide if we can use balanceOf this account when needed
        // TODO: Decide if both of these are necessary - for now will just save in this spot and ignore if not needed later
        // User and decision
    }
}

// StateMaster is the master of launchpad state. He can remember everything and he is a smart guy.
contract StateMaster is Ownable {
    using SafeERC20 for ERC20;

    // user info mapping
    // (track, user address) => user info
    mapping(uint256 => mapping(address => SMLibrary.UserInfo)) public users;

    // array of track information
    SMLibrary.TrackInfo[] public tracks;

    constructor() {}

    // number of tracks
    function trackCount() external view returns (uint256) {
        return tracks.length;
    }

    // adds a new track, allowing the staking of a new token
    // stakeToken can be IDIA or an IDIA/IFUSD LP token, etc
    function addTrack(ERC20 stakeToken) public onlyOwner {
        // add track
        tracks.push(
            SMLibrary.TrackInfo({
                stakeToken: stakeToken,
                lastCampaignTime: 0, // default is 0
                totalDeposit: 0 // default is 0
            })
        );
    }
}
