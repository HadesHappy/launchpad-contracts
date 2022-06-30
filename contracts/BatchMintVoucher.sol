// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "../library/IICToken.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract BatchMintVoucher is Ownable {
    IICToken internal iicToken;

    constructor (address proxyAddr, address idiaAddr, address vestingPoolAddr) {
        iicToken = IICToken(proxyAddr);
        ERC20 idia = ERC20(idiaAddr);
        idia.approve(vestingPoolAddr, type(uint256).max);
    }

    function batchMint(
        address[] calldata users,
        uint64[] calldata terms,
        uint256[] calldata values,
        uint64[][] calldata maturities,
        uint32[][] calldata percentages,
        string[] calldata originalInvestors
    ) external {
        for (uint i = 0; i < terms.length; i++) {
            (, uint256 tokenId) = iicToken.mint(
                terms[i],
                values[i],
                maturities[i],
                percentages[i],
                originalInvestors[i]
            );
            address userAddr = users[i];
            iicToken.transferFrom(address(this), userAddr, tokenId);
        }
    }

    function withdraw(address erc20Address) external onlyOwner {
        ERC20 token = ERC20(erc20Address);
        uint256 balance = token.balanceOf(address(this));
        token.transfer(owner(), balance);
    }

    function setProxyAddress(address proxyAddress) external onlyOwner {
        iicToken = IICToken(proxyAddress);
    }
}