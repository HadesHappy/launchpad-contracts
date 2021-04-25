//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';
import 'hardhat/console.sol';

contract TestToken is ERC20PresetMinterPauser {
    constructor(string memory _name, string memory _symbol, uint256 startingSupply)
        ERC20PresetMinterPauser(_name, _symbol)
    {
      _mint(msg.sender, startingSupply);
    }
}
