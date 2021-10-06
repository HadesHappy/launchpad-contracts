// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
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
    bytes32 whitelistRootHash;
    // amount of sale token to sell
    uint256 public saleAmount;
    // tracks amount purchased by each address
    mapping(address => uint256) public paymentReceived;
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
    uint80 public allocSnapshotBlock;
    // start block when sale is active (inclusive)
    uint256 public startBlock;
    // end block when sale is active (inclusive)
    uint256 public endBlock;
    // withdraw/cash delay in blocks (inclusive)
    uint24 public withdrawDelay;
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
    event Purchase(address indexed sender, uint256 indexed paymentAmount);
    event Withdraw(address indexed sender, uint256 indexed amount);
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
        uint80 _allocSnapshotBlock,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _maxTotalPayment
    ) {
        // funder cannot be 0
        require(_funder != address(0), '0x0 funder');
        // sale token cannot be 0
        require(address(_saleToken) != address(0), '0x0 saleToken');
        // start block must be in future
        require(block.number < _startBlock, 'start block too early');
        // end block must be after start block
        require(_startBlock < _endBlock, 'end block before start');

        salePrice = _salePrice; // can be 0 (for giveaway)
        funder = _funder;
        paymentToken = _paymentToken; // can be 0 (for giveaway)
        saleToken = _saleToken;
        allocationMaster = _allocationMaster; // can be 0 (with allocation override)
        trackId = _trackId; // can be 0 (with allocation override)
        allocSnapshotBlock = _allocSnapshotBlock; // can be 0 (with allocation override)
        startBlock = _startBlock;
        endBlock = _endBlock;
        maxTotalPayment = _maxTotalPayment; // can be 0 (for giveaway)
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
        require(block.number < startBlock, 'sale already started');

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
        require(block.number < startBlock, 'sale already started');

        minTotalPayment = _minTotalPayment;

        // emit
        emit SetMinTotalPayment(_minTotalPayment);
    }

    // Function for owner to set an optional, flat allocation override
    function setSaleTokenAllocationOverride(
        uint256 _saleTokenAllocationOverride
    ) external onlyOwner {
        // sale must not have started
        require(block.number < startBlock, 'sale already started');

        saleTokenAllocationOverride = _saleTokenAllocationOverride;

        // emit
        emit SetSaleTokenAllocationOverride(_saleTokenAllocationOverride);
    }

    // Function for owner to set an optional, separate casher
    function setCasher(address _casher) external onlyOwner {
        // sale must not have started
        require(block.number < startBlock, 'sale already started');

        casher = _casher;

        // emit
        emit SetCasher(_casher);
    }

    // Function for owner to set an optional, separate whitelist setter
    function setWhitelistSetter(address _whitelistSetter) external onlyOwner {
        // sale must not have started
        require(block.number < startBlock, 'sale already started');

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
            allocSnapshotBlock
        );
        uint256 totalWeight = allocationMaster.getTotalStakeWeight(
            trackId,
            allocSnapshotBlock
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
        require(startBlock <= block.number, 'sale has not begun');
        require(block.number <= endBlock, 'sale over');

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

        // must be past end block plus withdraw delay
        require(endBlock + withdrawDelay < block.number, 'cannot withdraw yet');
        // prevent repeat withdraw
        require(hasWithdrawn[_msgSender()] == false, 'already withdrawn');
        // must not be a zero price sale
        require(salePrice != 0, 'use withdrawGiveaway');

        // get payment received
        uint256 payment = paymentReceived[_msgSender()];

        // calculate amount of sale token owed to buyer
        uint256 saleTokenOwed = (payment * SALE_PRICE_DECIMALS) / salePrice;

        // set withdrawn to true
        hasWithdrawn[_msgSender()] = true;

        // increment withdrawer count
        withdrawerCount += 1;

        // transfer owed sale token to buyer
        saleToken.safeTransfer(_msgSender(), saleTokenOwed);

        // emit
        emit Withdraw(_msgSender(), saleTokenOwed);
    }

    // Function to withdraw (redeem) tokens from a zero cost "giveaway" sale
    function withdrawGiveaway(bytes32[] calldata merkleProof)
        external
        nonReentrant
    {
        // must be past end block plus withdraw delay
        require(endBlock + withdrawDelay < block.number, 'cannot withdraw yet');
        // prevent repeat withdraw
        require(hasWithdrawn[_msgSender()] == false, 'already withdrawn');
        // must be a zero price sale
        require(salePrice == 0, 'not a giveaway');
        // if there is whitelist, require that user is whitelisted by checking proof
        require(
            whitelistRootHash == 0 || checkWhitelist(_msgSender(), merkleProof),
            'proof invalid'
        );

        // each participant in the zero cost "giveaway" gets a flat amount of sale token, as set by the override
        uint256 saleTokenOwed = saleTokenAllocationOverride;

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
        // must be past end block plus withdraw delay
        require(endBlock + withdrawDelay < block.number, 'cannot withdraw yet');
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
