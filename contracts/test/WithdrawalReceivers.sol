// SPDX-License-Identifier: ISC
pragma solidity ^0.8.30;

import {DappTokenSale} from "../DappTokenSale.sol";

// Test fixtures only. These are never deployed by scripts/deploy.ts.
contract RejectEther {
    receive() external payable { revert("ETH rejected"); }
}

contract WithdrawalProbe {
    DappTokenSale public immutable sale;
    bool public reentrySucceeded;
    uint256 public received;

    constructor(DappTokenSale sale_) { sale = sale_; }
    function acceptOwnership() external { sale.acceptOwnership(); }
    function withdraw() external { sale.withdrawProceeds(payable(address(this))); }

    receive() external payable {
        received += msg.value;
        (reentrySucceeded,) = address(sale).call(
            abi.encodeCall(sale.withdrawProceeds, (payable(address(this))))
        );
    }
}
