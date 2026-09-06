// SPDX-License-Identifier: ISC
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fixed-price sale for a standard, non-rebasing, 18-decimal ERC-20.
/// @dev Purchase counts and the sale allocation are WHOLE tokens; transfers use base units.
contract DappTokenSale is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOKEN_UNIT = 1e18;
    IERC20 public immutable tokenContract;
    uint256 public immutable tokenPrice;
    uint256 public immutable saleAllocation;
    uint256 public tokensSold;
    uint256 public totalRaised;
    bool public saleEnded;

    error InvalidToken();
    error InvalidPrice();
    error InvalidAllocation();
    error InvalidAmount();
    error IncorrectPayment(uint256 expected, uint256 received);
    error AllocationExceeded(uint256 remaining, uint256 requested);
    error InsufficientInventory(uint256 available, uint256 requested);
    error SaleClosed();
    error InvalidRecipient();
    error NothingToWithdraw();
    error EtherTransferFailed();
    error OwnershipRenunciationDisabled();

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 paid);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);
    event SaleEnded(address indexed owner, uint256 returnedBaseUnits);

    constructor(address token_, uint256 price_, uint256 allocation_, address owner_)
        Ownable(owner_)
    {
        if (token_.code.length == 0 || IERC20Metadata(token_).decimals() != 18) revert InvalidToken();
        if (price_ == 0) revert InvalidPrice();
        if (allocation_ == 0 || allocation_ > IERC20(token_).totalSupply() / TOKEN_UNIT) {
            revert InvalidAllocation();
        }
        tokenContract = IERC20(token_);
        tokenPrice = price_;
        saleAllocation = allocation_;
    }

    function buyTokens(uint256 amount) external payable nonReentrant whenNotPaused {
        if (saleEnded) revert SaleClosed();
        if (amount == 0) revert InvalidAmount();
        uint256 remaining = saleAllocation - tokensSold;
        if (amount > remaining) revert AllocationExceeded(remaining, amount);
        uint256 cost = amount * tokenPrice;
        if (msg.value != cost) revert IncorrectPayment(cost, msg.value);
        uint256 available = tokenContract.balanceOf(address(this)) / TOKEN_UNIT;
        if (amount > available) revert InsufficientInventory(available, amount);

        tokensSold += amount;
        totalRaised += msg.value;
        tokenContract.safeTransfer(msg.sender, amount * TOKEN_UNIT);
        emit TokensPurchased(msg.sender, amount, msg.value);
    }

    function pause() external onlyOwner {
        if (saleEnded) revert SaleClosed();
        _pause();
    }

    function unpause() external onlyOwner {
        if (saleEnded) revert SaleClosed();
        _unpause();
    }

    /// @notice Closes permanently and returns unsold tokens. Withdraw ETH separately.
    /// @dev Separating closure from ETH withdrawal allows contract owners that reject ETH.
    function endSale() external onlyOwner nonReentrant {
        if (saleEnded) revert SaleClosed();
        saleEnded = true;
        uint256 unsold = tokenContract.balanceOf(address(this));
        if (unsold != 0) tokenContract.safeTransfer(owner(), unsold);
        emit SaleEnded(owner(), unsold);
    }

    /// @notice Owner may withdraw proceeds before or after closure, including while paused.
    function withdrawProceeds(address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert EtherTransferFailed();
        emit ProceedsWithdrawn(recipient, amount);
    }

    /// @dev Prevents accidentally orphaning sale inventory or ETH proceeds.
    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }
}
