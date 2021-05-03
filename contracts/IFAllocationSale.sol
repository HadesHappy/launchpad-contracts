// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IFAllocationMaster.sol';

contract IFAllocationSale is Ownable {
    using SafeERC20 for ERC20;

    // CONSTANTS

    uint256 constant SALE_PRICE_DECIMALS = 10**18;

    // SALE STATE

    // amount of sale token to sell
    uint256 public saleAmount;
    // tracks amount purchased by each address
    mapping(address => uint256) public paymentReceived;

    // SALE CONSTRUCTOR PARAMS

    // sale price; IMPORTANT - in units of ([paymentToken/saleToken] * SALE_PRICE_DECIMALS)
    //      for example, if selling ABC token for 10 IFUSD each, then
    //      sale price will be 10 * SALE_PRICE_DECIMALS = 10_000_000_000_000_000_000
    uint256 public salePrice;
    // funder
    address public funder;
    // payment token
    ERC20 public paymentToken;
    // sale token
    ERC20 public saleToken;
    // allocation master
    IFAllocationMaster public allocationMaster;
    // track id
    uint256 public trackId;
    // allocation snapshot block
    uint256 public allocSnapshotBlock;
    // start block when sale is active (inclusive)
    uint256 public startBlock;
    // end block when sale is active (inclusive)
    uint256 public endBlock;
    // min for deposits, to ensure that every track has some liquidity in the long run
    uint256 public minDeposit;
    // max for deposits, where penalty may be levied later on
    uint256 public maxDeposit;

    // EVENTS

    event Fund(address indexed sender, uint256 amount);
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
        uint256 _trackId,
        uint256 _allocSnapshotBlock,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _minDeposit,
        uint256 _maxDeposit
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
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
    }

    // MODIFIERS

    // Throws if called by any account other than the funder.
    modifier onlyFunder() {
        require(_msgSender() == funder, 'caller is not the funder');
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

    // Function for making purchase in allocation sale
    function purchase(uint256 paymentAmount) external {
        // sale must be active
        require(startBlock <= block.number, 'sale has not begun');
        require(block.number <= endBlock, 'sale over');

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

    // Function for withdrawing purchased sale token after sale end
    function withdraw() external {
        // sale must be over
        require(endBlock < block.number, 'sale must be over');

        // get payment received
        uint256 payment = paymentReceived[_msgSender()];

        // calculate amount of sale token owed to buyer
        uint256 saleTokenOwed = (payment * SALE_PRICE_DECIMALS) / salePrice;

        // todo: make sure to check decimals of buy and sell tokens
        // currently, assumes buy and sell tokens have same # of decimals

        // transfer owed sale token to buyer
        saleToken.safeTransfer(_msgSender(), saleTokenOwed);

        // emit
        emit Withdraw(_msgSender());
    }

    // Function for funder to cash in payment token
    function cash() external onlyFunder {
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
