// SPDX-License-Identifier: ISC
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Deliberately incompatible token for constructor validation tests only.
contract SixDecimalToken is ERC20 {
    constructor() ERC20("Six decimals", "SIX") { _mint(msg.sender, 1_000_000 * 1e6); }
    function decimals() public pure override returns (uint8) { return 6; }
}
