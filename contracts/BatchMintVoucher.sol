
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "../library/IICToken.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract BatchMintVoucher {
    address PROXY_ADDRESS = 0x0c491ac26d2cDDa63667DF65b43b967B9293161c;
    address IDIA_ADDRESS = 0x0b15Ddf19D47E6a86A56148fb4aFFFc6929BcB89;
    address VESTINGPOOL_ADDRESS = 0x67D48Ce0E776147B0d996e1FaCC0FbAA91b1CBC4;

    constructor () {}

    function mint() external {
        IICToken iicToken = IICToken(PROXY_ADDRESS);
        uint64[] memory maturities = new uint64[](1);
        maturities[0] = uint64(1632960000);
        uint32[] memory percentages = new uint32[](1);
        percentages[0] = uint32(10000);
        iicToken.mint(0, 1000, maturities, percentages, "");
    }

    function batchMint(uint256 n) external {
        IICToken iicToken = IICToken(PROXY_ADDRESS);
        uint64[] memory maturities = new uint64[](1);
        maturities[0] = uint64(1632960000);
        uint32[] memory percentages = new uint32[](1);
        percentages[0] = uint32(10000);
        for (uint i = 0; i < n; i++) {
            iicToken.mint(0, 1000, maturities, percentages, "");
        }
    }

    function approve() external {
        ERC20 idia = ERC20(IDIA_ADDRESS);
        idia.approve(VESTINGPOOL_ADDRESS, 100000000000000000000000000);
    }
}