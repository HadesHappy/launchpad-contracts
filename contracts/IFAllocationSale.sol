// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './IFAllocationMaster.sol';

contract IFAllocationSale is Ownable {
    using SafeERC20 for ERC20;

    // tokens
    ERC20 public ifusd;
    ERC20 public idia;

    // start block when sale is active (inclusive)
    uint256 public startBlock;
    // end block when sale is active (inclusive)
    uint256 public endBlock;
    // allocation snapshot block
    uint256 public allocSnapshotBlock;
    // min for deposits, to ensure that every track has some liquidity in the long run
    uint256 public minDeposit;
    // max for deposits, where penalty may be levied later on
    uint256 public maxDeposit;

    IFAllocationMaster allocationMaster;

    // events
    event Cash(address indexed sender, uint256 balance);
    event EmergencyErc20Retrieve(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    // entrypoint
    constructor(
        IFAllocationMaster _allocationMaster,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _allocSnapshotBlock,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        ERC20 _ifusd,
        ERC20 _idia
    ) {
        allocationMaster = _allocationMaster;
        startBlock = _startBlock;
        endBlock = _endBlock;
        allocSnapshotBlock = _allocSnapshotBlock;
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        ifusd = _ifusd;
        idia = _idia;
    }

    // Function for the multisig to cash in the accrued idia tokens for distribution into futher baskets of usage
    // Claiming ifUSD and later needs to assign it to governance multisig to distribute to project team during fundraise
    function cash() external onlyOwner {
        uint256 ifusdBal = ifusd.balanceOf(address(this));
        // Require the cash amount to be less than the amount totally deposited
        require(ifusdBal > 0, 'not enough cash');
        // Split the _amount to be cashed out in half.
        ifusd.safeTransfer(address(msg.sender), ifusdBal);

        // emit
        emit Cash(msg.sender, ifusdBal);
    }

    // // EMERGENCY ERC20 Rescue ONLY - unstake all erroneous sent in to this address.
    // // cannot unstake idia in the contract, this ensures that owner does not have a way to touch idia tokens
    // // in this contract inappropriately
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
