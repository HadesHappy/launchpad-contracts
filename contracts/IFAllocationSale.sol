// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IFAllocationMaster.sol';

contract IFAllocationSale is Ownable {
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

    // SALE CONSTRUCTOR PARAMS

    // Sale price in units of paymentToken/saleToken with SALE_PRICE_DECIMALS decimals
    // For example, if selling ABC token for 10 IFUSD each, then
    // sale price will be 10 * SALE_PRICE_DECIMALS = 10_000_000_000_000_000_000
    // NOTE: sale price must accomodate any differences in decimals between sale and payment tokens
    uint256 public salePrice;
    // funder
    address public funder;
    // optional casher (settable by owner)
    address public casher;
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
    // max for payment token amount
    uint256 public maxTotalPayment;

    // EVENTS

    event Fund(address indexed sender, uint256 amount);
    event SetCasher(address indexed casher);
    event Purchase(address indexed sender, uint256 paymentAmount);
    event Withdraw(address indexed sender);
    event Cash(address indexed sender, uint256 balance);
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
        salePrice = _salePrice;
        funder = _funder;
        paymentToken = _paymentToken;
        saleToken = _saleToken;
        allocationMaster = _allocationMaster;
        trackId = _trackId;
        allocSnapshotBlock = _allocSnapshotBlock;
        startBlock = _startBlock;
        endBlock = _endBlock;
        maxTotalPayment = _maxTotalPayment;
    }

    // MODIFIERS

    // Throws if called by any account other than the funder.
    modifier onlyFunder() {
        require(_msgSender() == funder, 'caller is not the funder');
        _;
    }

    // Throws if called by any account other than the casher.
    modifier onlyCasherOrOwner() {
        require(
            _msgSender() == casher || _msgSender() == owner(),
            'caller is not the casher or owner'
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

    // Function for owner to set an optional, separate casher
    function setCasher(address _casher) external onlyOwner {
        casher = _casher;

        // emit
        emit SetCasher(_casher);
    }

    // Function for owner to set a whitelist; if not set, then everyone allowed
    function setWhitelist(bytes32 _whitelistRootHash) external onlyOwner {
        whitelistRootHash = _whitelistRootHash;
    }

    // Returns true if user is on whitelist, otherwise false
    function checkWhitelist(uint256 index, bytes32[] calldata merkleProof)
        public
        view
        returns (bool)
    {
        // compute merkle leaf from input
        bytes32 leaf = keccak256(abi.encodePacked(index, _msgSender()));

        // console.log(_msgSender(),'foo', user);
        console.log('leaf');
        console.logBytes32(leaf);

        bytes32 computedHash = leaf;
        console.log('loop');
        for (uint256 i = 0; i < merkleProof.length; i++) {
            bytes32 proofElement = merkleProof[i];

            if (computedHash <= proofElement) {
                console.logBytes(abi.encodePacked(computedHash, proofElement));

                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );

                console.logBytes32(computedHash);
                console.logBytes32(proofElement);
            } else {
                console.logBytes(abi.encodePacked(computedHash, proofElement));

                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );

                console.logBytes32(computedHash);
                console.logBytes32(proofElement);
            }
        }

        // compute merkle proof and return result
        return MerkleProof.verify(merkleProof, whitelistRootHash, leaf);
    }

    // Function for making purchase in allocation sale
    function purchase(uint256 paymentAmount) public {
        // sale must be active
        require(startBlock <= block.number, 'sale has not begun');
        require(block.number <= endBlock, 'sale over');

        // there must not be a whitelist set (sales that use whitelist must be used with whitelistedPurchase)
        require(whitelistRootHash == 0, 'use whitelistedPurchase');

        // amount must be greater than 0
        require(paymentAmount > 0, 'amount is 0');

        // CHECK AGAINST EXCEEDING ALLOCATION

        // get user allocation as ratio (multiply by 10**18, aka E18, for precision)
        uint256 userWeight =
            allocationMaster.getUserStakeWeight(
                trackId,
                _msgSender(),
                allocSnapshotBlock
            );
        uint256 totalWeight =
            allocationMaster.getTotalStakeWeight(trackId, allocSnapshotBlock);
        uint256 allocationE18 = (userWeight * 10**18) / totalWeight;

        // calculate max amount of obtainable sale token
        uint256 saleTokenAllocationE18 = (saleAmount * allocationE18);

        // calculate equivalent value in payment token
        uint256 paymentTokenAllocation =
            (saleTokenAllocationE18 * salePrice) / SALE_PRICE_DECIMALS / 10**18;

        // console.log('sale token allocation', saleTokenAllocationE18 / 10**18);
        // console.log('payment token allocation', paymentTokenAllocation);

        // total payment received must not exceed max payment amount
        require(
            paymentReceived[_msgSender()] + paymentAmount <= maxTotalPayment,
            'exceeds max payment'
        );
        // total payment received must not exceed paymentTokenAllocation
        require(
            paymentReceived[_msgSender()] + paymentAmount <=
                paymentTokenAllocation,
            'exceeds allocation'
        );

        // transfer specified amount from user to this contract
        paymentToken.safeTransferFrom(
            address(_msgSender()),
            address(this),
            paymentAmount
        );

        // increase payment received amount
        paymentReceived[_msgSender()] += paymentAmount;

        // emit
        emit Purchase(_msgSender(), paymentAmount);
    }

    function whitelistedPurchase(
        uint256 paymentAmount,
        uint256 index,
        bytes32[] calldata merkleProof
    ) external {
        // require that user is whitelisted by checking proof
        require(checkWhitelist(index, merkleProof), 'proof invalid');

        purchase(paymentAmount);
    }

    // Function for withdrawing purchased sale token after sale end
    function withdraw() external {
        // sale must be over
        require(endBlock < block.number, 'sale must be over');
        // prevent repeat withdraw
        require(hasWithdrawn[_msgSender()] == false, 'already withdrawn');

        // get payment received
        uint256 payment = paymentReceived[_msgSender()];

        // calculate amount of sale token owed to buyer
        uint256 saleTokenOwed = (payment * SALE_PRICE_DECIMALS) / salePrice;

        // set withdrawn to true
        hasWithdrawn[_msgSender()] = true;

        // transfer owed sale token to buyer
        saleToken.safeTransfer(_msgSender(), saleTokenOwed);

        // emit
        emit Withdraw(_msgSender());
    }

    // Function for funder to cash in payment token
    function cash() external onlyCasherOrOwner {
        // get amount of payment token received
        uint256 paymentTokenBal = paymentToken.balanceOf(address(this));

        // transfer all to owner
        paymentToken.safeTransfer(address(_msgSender()), paymentTokenBal);

        // emit
        emit Cash(_msgSender(), paymentTokenBal);
    }

    // retrieve tokens erroneously sent in to this address
    function emergencyTokenRetrieve(address token) external onlyOwner {
        // cannot be payment or sale tokens
        require(token != address(paymentToken));
        require(token != address(saleToken));

        // transfer all
        ERC20(token).safeTransfer(
            _msgSender(),
            ERC20(token).balanceOf(address(this))
        );

        // emit
        emit EmergencyTokenRetrieve(
            _msgSender(),
            ERC20(token).balanceOf(address(this))
        );
    }
}
