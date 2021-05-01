// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IFAllocationMaster.sol';

contract IFAllocationSale is Ownable {
    using SafeERC20 for ERC20;

    // SALE STATE

    // tracks amount purchased by each address
    mapping(address => uint256) public paymentReceived;

    // SALE PARAMS

    // sale price; IMPORTANT - in units of [paymentToken / saleToken * 10**18]
    //      for example, if selling ABC token for 10 IFUSD each, then
    //      sale price will be 10 * 10**18 = 10_000_000_000_000_000_000
    uint256 salePrice;
    // payment token
    ERC20 public paymentToken;
    // sale token
    ERC20 public saleToken;
    // allocation master
    IFAllocationMaster allocationMaster;
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

    event Cash(address indexed sender, uint256 balance);
    event EmergencyErc20Retrieve(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    // CONSTRUCTOR

    constructor(
        uint256 _salePrice,
        ERC20 _paymentToken,
        ERC20 _saleToken,
        IFAllocationMaster _allocationMaster,
        uint256 _allocSnapshotBlock,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _minDeposit,
        uint256 _maxDeposit
    ) {
        salePrice = _salePrice;
        paymentToken = _paymentToken;
        saleToken = _saleToken;
        allocationMaster = _allocationMaster;
        allocSnapshotBlock = _allocSnapshotBlock;
        startBlock = _startBlock;
        endBlock = _endBlock;
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
    }

    // FUNCTIONS

    // Function for making purchase in allocation sale
    function purchase(uint256 paymentAmount) external {
        // sale must be active
        require(startBlock <= block.number, 'sale has not begun');
        require(block.number <= endBlock, 'sale over');

        // amount must be greater than 0
        require(paymentAmount > 0, 'amount is 0');

        // todo: make sure below allocation cap

        // transfer specified amount from user to this contract
        paymentToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            paymentAmount
        );

        // increase payment received amount
        paymentReceived[msg.sender] += paymentAmount;
    }

    // Function for withdrawing sale token after sale end
    function withdraw() external {
        // sale must be over
        require(endBlock < block.number, 'sale must be over');

        // get payment received
        uint256 payment = paymentReceived[msg.sender];

        // calculate amount of sale token owed to buyer
        uint256 saleTokenOwed = (payment * 10**18) / salePrice;

        // todo: make sure to check decimals of buy and sell tokens

        // transfer owed sale token to buyer
        saleToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            saleTokenOwed
        );
    }

    // Function for sale administrator to cash in payment token
    function cash() external onlyOwner {
        // get amount of payment token received
        uint256 paymentTokenBal = paymentToken.balanceOf(address(this));

        // transfer all to owner
        paymentToken.safeTransfer(address(msg.sender), paymentTokenBal);

        // emit
        emit Cash(msg.sender, paymentTokenBal);
    }

    // // EMERGENCY ERC20 Rescue ONLY - unstake erroneous tokens sent in to this address.
    // function emergencyErc20Retrieve(address token) external onlyOwner {
    //     require(token != address(idia)); // only allow retrieval for nonidia tokens
    //     ERC20(token).safeTransfer(
    //         address(msg.sender),
    //         ERC20(token).balanceOf(address(this))
    //     ); // helps remove all
    //     emit EmergencyErc20Retrieve(
    //         address(msg.sender),
    //         ERC20(token).balanceOf(address(this))
    //     );
    // }
}
