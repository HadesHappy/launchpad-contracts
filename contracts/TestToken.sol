//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';
import 'hardhat/console.sol';

contract TestToken is ERC20PresetMinterPauser {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 startingSupply
    ) ERC20PresetMinterPauser(_name, _symbol) {
        _mint(msg.sender, startingSupply);
    }
}
