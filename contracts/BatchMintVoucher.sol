// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "../library/IICToken.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract BatchMintVoucher is Ownable {
    IICToken internal iicToken;
    ERC20 internal idia;

    struct VoucherParams {
        address[] users;
        uint64[] terms;
        uint256[] values;
        uint64[][] maturities;
        uint32[][] percentages;
        string[] originalInvestors;
    }

    constructor (address proxyAddr, address idiaAddr, address vestingPoolAddr) {
        iicToken = IICToken(proxyAddr);
        idia = ERC20(idiaAddr);
        idia.approve(vestingPoolAddr, type(uint256).max);
    }

    function batchMint(
        // total value of the underlying token needed to mint the vouchers
        uint256 totalValue,
        VoucherParams calldata params
    ) external {
        // send the required tokens to the contract
        idia.transferFrom(msg.sender, address(this), totalValue);
        for (uint i = 0; i < params.users.length; i++) {
            // mint a voucher
            (, uint256 tokenId) = iicToken.mint(
                params.terms[i],
                params.values[i],
                params.maturities[i],
                params.percentages[i],
                params.originalInvestors[i]
            );
            address userAddr = params.users[i];
            // transfer the voucher to a user
            iicToken.transferFrom(address(this), userAddr, tokenId);
        }
    }

    function withdraw(address erc20Address) external onlyOwner {
        ERC20 token = ERC20(erc20Address);
        uint256 balance = token.balanceOf(address(this));
        token.transfer(owner(), balance);
    }

    function withdrawEth() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function setProxyAddress(address proxyAddress) external onlyOwner {
        iicToken = IICToken(proxyAddress);
    }
}