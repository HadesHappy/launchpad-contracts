// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import './IFAllocationMaster.sol';

contract IFAllocationSale is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    // CONSTANTS

    // number of decimals of sale price
    uint64 constant SALE_PRICE_DECIMALS = 10**18;

    // SALE STATE

    // whitelist merkle root; if not set, then sale is open to everyone that has allocation
    bytes32 public whitelistRootHash;
    // amount of sale token to sell
    uint256 public saleAmount;
    // tracks amount purchased by each address
    mapping(address => uint256) public paymentReceived;
    // tracks amount claimed by each address
    mapping(address => uint256) public paymentClaimed;
    // tracks whether user has already successfully withdrawn
    mapping(address => bool) public hasWithdrawn;
    // tracks whether sale has been cashed
    bool public hasCashed;

    // summary stats
    // counter of unique purchasers
    uint32 public purchaserCount;
    // counter of unique withdrawers (doesn't count "cash"ing)
    uint32 public withdrawerCount;
    // total payment received for sale
    uint256 public totalPaymentReceived;

    // SALE CONSTRUCTOR PARAMS

    // Sale price in units of paymentToken/saleToken with SALE_PRICE_DECIMALS decimals
    // For example, if selling ABC token for 10 IFUSD each, then
    // sale price will be 10 * SALE_PRICE_DECIMALS = 10_000_000_000_000_000_000
    // NOTE: sale price must accomodate any differences in decimals between sale and payment tokens. If payment token has A decimals and sale token has B decimals, then the price must be adjusted by multiplying by 10**(A-B).
    // If A was 18 but B was only 12, then the salePrice should be adjusted by multiplying by 1,000,000. If A was 12 and B was 18, then salePrice should be adjusted by dividing by 1,000,000.

    //TODO: binary search or some function on allocMaster to give accurate timestamp from allocSnapshotTimestamp
    uint256 public salePrice;
    // funder
    address public funder;
    // optional casher (settable by owner)
    address public casher;
    // optional whitelist setter (settable by owner)
    address public whitelistSetter;
    // payment token
    ERC20 public paymentToken;
    // sale token
    ERC20 public saleToken;
    // allocation master
    IFAllocationMaster public allocationMaster;
    // track id
    uint24 public trackId;
    // allocation snapshot block
    uint80 public allocSnapshotTimestamp;
    // start timestamp when sale is active (inclusive)
    uint256 public startTime;
    // end timestamp when sale is active (inclusive)
    uint256 public endTime;
    // the most recent time the user claimed the saleToken
    uint256 public latestClaimTime;
    // withdraw/cash delay timestamp (inclusive)
    uint24 public withdrawDelay;
    // the time where the user can take all of the vested saleToken
    uint256 public vestingEndTime;
    // optional min for payment token amount
    uint256 public minTotalPayment;
    // max for payment token amount
    uint256 public maxTotalPayment;
    // optional flat allocation override
    uint256 public saleTokenAllocationOverride;

    // EVENTS

    event Fund(address indexed sender, uint256 amount);
    event SetMinTotalPayment(uint256 indexed minTotalPayment);
    event SetSaleTokenAllocationOverride(
        uint256 indexed saleTokenAllocationOverride
    );
    event SetCasher(address indexed casher);
    event SetWhitelistSetter(address indexed whitelistSetter);
    event SetWhitelist(bytes32 indexed whitelistRootHash);
    event SetWithdrawDelay(uint24 indexed withdrawDelay);
    event SetVestingEndTime(uint256 indexed vestingEndTime);
    event Purchase(address indexed sender, uint256 paymentAmount);
    event Withdraw(address indexed sender, uint256 amount);
    event Cash(
        address indexed sender,
        uint256 paymentTokenBalance,
        uint256 saleTokenBalance
    );
    event EmergencyTokenRetrieve(address indexed sender, uint256 amount);

    // CONSTRUCTOR

    constructor(
        uint256 _salePrice,
        address _funder,
        ERC20 _paymentToken,
        ERC20 _saleToken,
        IFAllocationMaster _allocationMaster,
        uint24 _trackId,
        uint80 _allocSnapshotTimestamp,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _maxTotalPayment
    ) {
        // saleToken shouldn't be the same as paymentToken
        require(_saleToken != _paymentToken, 'saleToken = paymentToken');
        // when salePrice != 0, paymentToken and maxTotalPayment shouldn't be 0
        require(
            _salePrice == 0 ||
                (_salePrice != 0 &&
                    address(_paymentToken) != address(0) &&
                    _maxTotalPayment != 0),
            'paymentToken or maxTotalPayment should not be 0 when salePrice is 0'
        );

        // funder cannot be 0
        require(_funder != address(0), '0x0 funder');
        // sale token cannot be 0
        require(address(_saleToken) != address(0), '0x0 saleToken');
        // start timestamp must be in future
        require(block.timestamp < _startTime, 'start timestamp too early');
        // end timestamp must be after start timestamp
        require(_startTime < _endTime, 'end timestamp before start');

        require(
            _allocSnapshotTimestamp > block.timestamp ||
                (_allocSnapshotTimestamp <= block.timestamp &&
                    _allocationMaster.getTotalStakeWeight(
                        _trackId,
                        _allocSnapshotTimestamp
                    ) >
                    0),
            'total weight is 0 on while using older timestamp'
        );

        salePrice = _salePrice; // can be 0 (for giveaway)
        funder = _funder;
        paymentToken = _paymentToken; // can be 0 (for giveaway)
        saleToken = _saleToken;
        allocationMaster = _allocationMaster; // can be 0 (with allocation override)
        trackId = _trackId; // can be 0 (with allocation override)
        allocSnapshotTimestamp = _allocSnapshotTimestamp; // can be 0 (with allocation override)
        startTime = _startTime;
        endTime = _endTime;
        maxTotalPayment = _maxTotalPayment; // can be 0 (for giveaway)
        latestClaimTime = _endTime;
    }

    // MODIFIERS

    // Throws if called by any account other than the funder.
    modifier onlyFunder() {
        require(_msgSender() == funder, 'caller not funder');
        _;
    }

    // Throws if called by any account other than the casher.
    modifier onlyCasherOrOwner() {
        require(
            _msgSender() == casher || _msgSender() == owner(),
            'caller not casher or owner'
        );
        _;
    }

    // Throws if called by any account other than the whitelist setter.
    modifier onlyWhitelistSetterOrOwner() {
        require(
            _msgSender() == whitelistSetter || _msgSender() == owner(),
            'caller not whitelist setter or owner'
        );
        _;
    }

    // FUNCTIONS

    // Function for funding sale with sale token (called by project team)
    function fund(uint256 amount) external onlyFunder {
        // sale must not have started
        require(block.timestamp < startTime, 'sale already started');

        // transfer specified amount from funder to this contract
        saleToken.safeTransferFrom(_msgSender(), address(this), amount);

        // increase tracked sale amount
        saleAmount += amount;

        // emit
        emit Fund(_msgSender(), amount);
    }

    // Function for owner to set an optional, minTotalPayment
    function setMinTotalPayment(uint256 _minTotalPayment) external onlyOwner {
        // sale must not have started
        require(block.timestamp < startTime, 'sale already started');

        minTotalPayment = _minTotalPayment;

        // emit
        emit SetMinTotalPayment(_minTotalPayment);
    }

    // Function for owner to set an optional, flat allocation override
    function setSaleTokenAllocationOverride(
        uint256 _saleTokenAllocationOverride
    ) external onlyOwner {
        // sale must not have started
        require(block.timestamp < startTime, 'sale already started');

        saleTokenAllocationOverride = _saleTokenAllocationOverride;

        // emit
        emit SetSaleTokenAllocationOverride(_saleTokenAllocationOverride);
    }

    // Function for owner to set an optional, separate casher
    function setCasher(address _casher) external onlyOwner {
        // sale must not have started
        require(block.timestamp < startTime, 'sale already started');

        casher = _casher;

        // emit
        emit SetCasher(_casher);
    }

    // Function for owner to set an optional, separate whitelist setter
    function setWhitelistSetter(address _whitelistSetter) external onlyOwner {
        // sale must not have started
        require(block.timestamp < startTime, 'sale already started');

        whitelistSetter = _whitelistSetter;

        // emit
        emit SetWhitelistSetter(_whitelistSetter);
    }

    // Function for owner or whitelist setter to set a whitelist; if not set, then everyone allowed
    function setWhitelist(bytes32 _whitelistRootHash)
        external
        onlyWhitelistSetterOrOwner
    {
        whitelistRootHash = _whitelistRootHash;

        // emit
        emit SetWhitelist(_whitelistRootHash);
    }

    // Function for owner to set a withdraw delay
    function setWithdrawDelay(uint24 _withdrawDelay) external onlyOwner {
        withdrawDelay = _withdrawDelay;

        // emit
        emit SetWithdrawDelay(_withdrawDelay);
    }

    // Function for owner to set a vesting end time
    function setVestingEndTime(uint256 _vestingEndTime) external onlyOwner {
        // require(_vestingEndTime > endTime + withdrawDelay, "Vesting end time has to be after withdrawl start time");
        vestingEndTime = _vestingEndTime;

        // emit
        emit SetVestingEndTime(_vestingEndTime);
    }

    function getVestingEndTime() public view returns (uint256) {
        return vestingEndTime;
    }
    // Returns true if user is on whitelist, otherwise false
    function checkWhitelist(address user, bytes32[] calldata merkleProof)
        public
        view
        returns (bool)
    {
        // compute merkle leaf from input
        bytes32 leaf = keccak256(abi.encodePacked(user));

        // verify merkle proof
        return MerkleProof.verify(merkleProof, whitelistRootHash, leaf);
    }

    // Function to get the total allocation of a user in allocation sale
    // Allocation is calculated via the override if set, and otherwise
    // allocation is calculated by the allocation master data.
    function getTotalPaymentAllocation(address user)
        public
        view
        returns (uint256)
    {
        // get user allocation as ratio (multiply by 10**18, aka E18, for precision)
        uint256 userWeight = allocationMaster.getUserStakeWeight(
            trackId,
            user,
            allocSnapshotTimestamp
        );
        uint256 totalWeight = allocationMaster.getTotalStakeWeight(
            trackId,
            allocSnapshotTimestamp
        );

        // total weight must be greater than 0
        require(totalWeight > 0, 'total weight is 0');

        // determine TOTAL allocation (in payment token)
        uint256 paymentTokenAllocation;

        // different calculation for whether override is set
        if (saleTokenAllocationOverride == 0) {
            // calculate allocation (times 10**18)
            uint256 allocationE18 = (userWeight * 10**18) / totalWeight;

            // calculate max amount of obtainable sale token
            uint256 saleTokenAllocationE18 = (saleAmount * allocationE18);

            // calculate equivalent value in payment token
            paymentTokenAllocation =
                (saleTokenAllocationE18 * salePrice) /
                SALE_PRICE_DECIMALS /
                10**18;
        } else {
            // override payment token allocation
            paymentTokenAllocation =
                (salePrice * saleTokenAllocationOverride) /
                SALE_PRICE_DECIMALS;
        }

        return paymentTokenAllocation;
    }

    // Function to get the MAX REMAINING amount of allocation for a user (in terms of payment token)
    // it is whichever is smaller:
    //      1. user's payment allocation, which is determined by
    //          a. the allocation master
    //          b. the allocation override
    //      2. maxTotalPayment
    function getMaxPayment(address user) public view returns (uint256) {
        // get the maximum total payment for a user
        uint256 max = getTotalPaymentAllocation(user);
        if (maxTotalPayment < max) {
            max = maxTotalPayment;
        }

        // calculate and return remaining
        return max - paymentReceived[user];
    }

    // Internal function for making purchase in allocation sale
    // Used by external functions `purchase` and `whitelistedPurchase`
    function _purchase(uint256 paymentAmount) internal nonReentrant {
        // sale must be active
        require(startTime <= block.timestamp, 'sale has not begun');
        require(block.timestamp <= endTime, 'sale over');

        // sale price must not be 0, which is a giveaway sale
        require(salePrice != 0, 'cannot purchase - giveaway sale');

        // amount must be greater than minTotalPayment
        // by default, minTotalPayment is 0 unless otherwise set
        require(paymentAmount > minTotalPayment, 'amount below min');

        // get max payment of user
        uint256 remaining = getMaxPayment(_msgSender());

        // payment must not exceed remaining
        require(paymentAmount <= remaining, 'exceeds max payment');

        // transfer specified amount from user to this contract
        paymentToken.safeTransferFrom(
            address(_msgSender()),
            address(this),
            paymentAmount
        );

        // if user is paying for the first time to this contract, increase counter
        if (paymentReceived[_msgSender()] == 0) purchaserCount += 1;

        // increase payment received amount
        paymentReceived[_msgSender()] += paymentAmount;

        // increase total payment received amount
        totalPaymentReceived += paymentAmount;

        // emit
        emit Purchase(_msgSender(), paymentAmount);
    }

    // purchase function when there is no whitelist
    function purchase(uint256 paymentAmount) external {
        // there must not be a whitelist set (sales that use whitelist must be used with whitelistedPurchase)
        require(whitelistRootHash == 0, 'use whitelistedPurchase');

        _purchase(paymentAmount);
    }

    // purchase function when there is a whitelist
    function whitelistedPurchase(
        uint256 paymentAmount,
        bytes32[] calldata merkleProof
    ) external {
        // require that user is whitelisted by checking proof
        require(checkWhitelist(_msgSender(), merkleProof), 'proof invalid');

        _purchase(paymentAmount);
    }

    // Function for withdrawing purchased sale token after sale end
    function withdraw() external nonReentrant {
        // if there is a whitelist, an un-whitelisted user will
        // not have any sale tokens to withdraw
        // so we do not check whitelist here

        // must be past end timestamp plus withdraw delay
        require(
            (endTime + withdrawDelay < block.timestamp) && (latestClaimTime < block.timestamp),
            'cannot withdraw yet'
        );
        // must not be a zero price sale
        require(salePrice != 0, 'use withdrawGiveaway');
        // get total payment received
        uint256 totalClaimable = paymentReceived[_msgSender()];
        // prevent repeat withdraw
        require(totalClaimable != 0, 'already withdrawn');

        uint256 currentClaimable = getCurrentClaimable(totalClaimable, _msgSender());
        paymentClaimed[_msgSender()] += currentClaimable;

        // calculate amount of sale token owed to buyer
        // TODO: calculate saleTokenOwned earlier to prevent rounding error
        uint256 saleTokenOwed = (currentClaimable * SALE_PRICE_DECIMALS) / salePrice;
        console.log('s', saleTokenOwed);
        console.log('c', paymentClaimed[_msgSender()]);

        // increment withdrawer count
        if (!hasWithdrawn[_msgSender()]) {
            withdrawerCount += 1;
            // set withdrawn to true
            hasWithdrawn[_msgSender()] = true;
        }

        // update last claimed time
        latestClaimTime = block.timestamp;
        // transfer owed sale token to buyer
        saleToken.safeTransfer(_msgSender(), saleTokenOwed);

        // emit
        emit Withdraw(_msgSender(), saleTokenOwed);
    }

    function getCurrentClaimable(uint256 totalClaimable, address user) public view returns (uint256) {
        if (vestingEndTime != 0) {
            // users can get all of the tokens after vestingEndTime
            if (block.timestamp > vestingEndTime) {
                console.log('r', paymentReceived[user]);
                console.log('c', paymentClaimed[user]);
                return paymentReceived[user] - paymentClaimed[user];
            }
            // linear vesting
            // currentClaimable = (now - last claimed time) / (total vesting time) * totalClaimable
            return totalClaimable * (block.timestamp - latestClaimTime) / (vestingEndTime - endTime + withdrawDelay);
        }
        return totalClaimable;
    }

    function getUserStakeValue(address user) public view returns (uint256) {
        uint256 userWeight = allocationMaster.getUserStakeWeight(
            trackId,
            user,
            allocSnapshotTimestamp
        );
        uint256 totalWeight = allocationMaster.getTotalStakeWeight(
            trackId,
            allocSnapshotTimestamp
        );
        // total weight must be greater than 0
        require(totalWeight > 0, 'total weight is 0');

        // calculate max amount of obtainable sale token by user
        return (saleAmount * userWeight) / (totalWeight);
    }

    // Function to withdraw (redeem) tokens from a zero cost "giveaway" sale
    function withdrawGiveaway(bytes32[] calldata merkleProof)
        external
        nonReentrant
    {
        // must be past end timestamp plus withdraw delay
        require(
            endTime + withdrawDelay < block.timestamp,
            'cannot withdraw yet'
        );
        // TODO: remove this after implementing currentClaimable calculation
        // prevent repeat withdraw
        require(hasWithdrawn[_msgSender()] == false, 'already withdrawn');
        // must be a zero price sale
        require(salePrice == 0, 'not a giveaway');
        // if there is whitelist, require that user is whitelisted by checking proof
        require(
            whitelistRootHash == 0 || checkWhitelist(_msgSender(), merkleProof),
            'proof invalid'
        );
        uint256 saleTokenOwed;
        // each participant in the zero cost "giveaway" gets a flat amount of sale token
        if (saleTokenAllocationOverride == 0) {
            // if there is no override, fetch the total payment allocation
            saleTokenOwed = getUserStakeValue(_msgSender());
        } else {
            // if override, set the override amount
            saleTokenOwed = saleTokenAllocationOverride;
        }
        // sale token owed must be greater than 0
        require(saleTokenOwed != 0, 'withdraw giveaway amount 0');

        // set withdrawn to true
        hasWithdrawn[_msgSender()] = true;

        // increment withdrawer count
        withdrawerCount += 1;

        // transfer giveaway sale token to participant
        saleToken.safeTransfer(_msgSender(), saleTokenOwed);

        // emit
        emit Withdraw(_msgSender(), saleTokenOwed);
    }

    // Function for funder to cash in payment token and unsold sale token
    function cash() external onlyCasherOrOwner {
        // must be past end timestamp plus withdraw delay
        require(
            endTime + withdrawDelay < block.timestamp,
            'cannot withdraw yet'
        );
        // prevent repeat cash
        require(!hasCashed, 'already cashed');

        // set hasCashed to true
        hasCashed = true;

        // get amount of payment token received
        uint256 paymentTokenBal = paymentToken.balanceOf(address(this));

        // transfer all
        paymentToken.safeTransfer(address(_msgSender()), paymentTokenBal);

        // get amount of sale token on contract
        uint256 saleTokenBal = saleToken.balanceOf(address(this));

        // get amount of sold token
        uint256 totalTokensSold = (totalPaymentReceived * SALE_PRICE_DECIMALS) /
            salePrice;

        // get principal (whichever is bigger between sale amount or amount on contract)
        uint256 principal = saleAmount < saleTokenBal
            ? saleTokenBal
            : saleAmount;

        // calculate amount of unsold sale token
        uint256 amountUnsold = principal - totalTokensSold;

        // transfer unsold
        saleToken.safeTransfer(address(_msgSender()), amountUnsold);

        // emit
        emit Cash(_msgSender(), paymentTokenBal, amountUnsold);
    }

    // retrieve tokens erroneously sent in to this address
    function emergencyTokenRetrieve(address token) external onlyOwner {
        // cannot be sale tokens
        require(token != address(saleToken));

        uint256 tokenBalance = ERC20(token).balanceOf(address(this));

        // transfer all
        ERC20(token).safeTransfer(_msgSender(), tokenBalance);

        // emit
        emit EmergencyTokenRetrieve(_msgSender(), tokenBalance);
    }
}
