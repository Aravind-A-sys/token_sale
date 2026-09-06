// SPDX-License-Identifier: ISC
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed-supply DAPP token. There are no post-deployment mint privileges.
contract DappToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 1e18;

    constructor(address initialOwner) ERC20("DApp Token", "DAPP") {
        _mint(initialOwner, INITIAL_SUPPLY);
    }
}
