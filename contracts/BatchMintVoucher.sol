// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "../library/IICToken.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract BatchMintVoucher is Ownable {
    // address PROXY_ADDRESS = 0x0c491ac26d2cDDa63667DF65b43b967B9293161c;
    // address IDIA_ADDRESS = 0x0b15Ddf19D47E6a86A56148fb4aFFFc6929BcB89;
    // address VESTINGPOOL_ADDRESS = 0x67D48Ce0E776147B0d996e1FaCC0FbAA91b1CBC4;
    IICToken internal iicToken;

    constructor (address proxyAddr, address idiaAddr, address vestingPoolAddr) {
        iicToken = IICToken(proxyAddr);
        ERC20 idia = ERC20(idiaAddr);
        idia.approve(vestingPoolAddr, type(uint256).max);
    }

    function batchMint(
        uint64[] calldata terms,
        uint256[] calldata values,
        uint64[][] calldata maturities,
        uint32[][] calldata percentages,
        string[] calldata originalInvestors
    ) external payable {
        require(
            (terms.length == values.length) && 
            (values.length == maturities.length) &&
            (maturities.length == percentages.length) && 
            (percentages.length == originalInvestors.length),
            "Params length are different"
        );
        for (uint i = 0; i < terms.length; i++) {
            iicToken.mint(
                terms[i],
                values[i],
                maturities[i],
                percentages[i],
                originalInvestors[i]
            );
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