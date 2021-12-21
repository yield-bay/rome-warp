// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interface/solarbeam/ISolarFactory.sol";
import "../interface/solarbeam/ISolarPair.sol";
import "../interface/solarbeam/ISolarRouter02.sol";
import "../interface/solarbeam/IERC20.sol";
import "../interface/solarbeam/IWETH.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Base contract for WarpIn & WarpOut
/// @author Nightwing from Yieldbay
/// @notice Base layer for Warp contracts. Functionality to pause, un-pause, and common functions shared between WarpIn.sol & WarpOut.sol
contract WarpBaseV1 is Ownable {
    using SafeERC20 for IERC20;

    bool public paused = false;

    /// @notice Toggles the pause state. Only owner() can call.
    /// @dev If paused is true, sets it to false. If paused is false, sets it to true.
    function togglePause() external onlyOwner {
        paused = !paused;
    }

    /// @notice Finds the addresses of the two tokens present in a Solarbeam liquidity pool.
    /// @param pair address of the solarbeam liquidity pool.
    /// @return token0 address of the first token in the liquidity pool pair.
    /// @return token1 address of the second token in the liquidity pool pair.
    function _fetchTokensFromPair(address pair)
        internal
        view
        returns (address token0, address token1)
    {
        ISolarPair solarPair = ISolarPair(pair);
        require(address(solarPair) != address(0), "PAIR_NOT_EXIST");

        token0 = solarPair.token0();
        token1 = solarPair.token1();
    }

    /// @notice Transfers the intended tokens from the address to the contract.
    /// @dev Used by WarpIn to obtain the token that the address wants to warp-in.
    /// @dev Used by WarpOut to obtain the LP tokens that the address wants to warp-out.
    /// @param from address of the token to transfer to the contract.
    /// @param amount the amount of `from` tokens to transfer to the contract.
    function _getTokens(address from, uint256 amount) internal {
        require(amount > 0, "ZERO_AMOUNT");

        // If fromToken is zero address, transfer $MOVR
        if (from == address(0)) {
            require(amount == msg.value, "MOVR_NEQ_AMOUNT");
            return;
        }

        IERC20(from).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Sends an ERC20 token from the contract to the receiver
    /// @dev Used by WarpIn to send the LP tokens to the receiver.
    /// @dev Used by WarpOut to send the target tokens to the receiver.
    /// @param token address of the token to send.
    /// @param amount the amount of tokens to send.
    /// @param receiver destination address; where the tokens need to be sent.
    function _sendTokens(
        address token,
        uint256 amount,
        address receiver
    ) internal {
        require(amount > 0, "ZERO_AMOUNT");

        IERC20(token).safeTransfer(receiver, amount);
    }

    /// @notice Sends $MOVR to an address.
    /// @param amount amount of $MOVR to send.
    /// @param receiver destination address; where the $MOVR needs to be sent.
    function _sendMOVR(uint256 amount, address payable receiver) internal {
        require(
            address(this).balance >= amount,
            "Address: insufficient balance"
        );

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = receiver.call{value: amount}("");
        require(success, "SEND_VALUE_FAIL");
    }

    /// @notice Approves the `spender` to spend the specified amount of an ERC20 token held by `this` contract.
    /// @param token address of the ERC20 token to approve.
    /// @param spender address of *who* can spend the contract's token.
    /// @param amount how many tokens can the `spender` spend.
    function _approveToken(
        address token,
        address spender,
        uint256 amount
    ) internal {
        bool success;
        // Set Approval back to 0.
        success = IERC20Solar(token).approve(spender, 0);
        require(success, "APPROVAL_FAILED");

        // Then, set Approval to the exact amount required.
        success = IERC20Solar(token).approve(spender, amount);
        require(success, "APPROVAL_FAILED");
    }

    modifier notPaused() {
        require(!paused, "CONTRACT_PAUSED");
        _;
    }
}
