// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interface/solarbeam/ISolarFactory.sol";
import "../interface/solarbeam/ISolarPair.sol";
import "../interface/solarbeam/ISolarRouter02.sol";
import "../interface/solarbeam/IERC20.sol";
import "../interface/solarbeam/IWETH.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract WarpBaseV1 is Ownable {
    using SafeERC20 for IERC20;

    bool public paused = false;

    function togglePause() external onlyOwner {
        paused = !paused;
    }

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

    function _getTokens(address from, uint256 amount) internal {
        require(amount > 0, "ZERO_AMOUNT");

        // If fromToken is zero address, transfer $MOVR
        if (from == address(0)) {
            require(amount == msg.value, "MOVR_NEQ_AMOUNT");
            return;
        }

        IERC20(from).safeTransferFrom(msg.sender, address(this), amount);
    }

    function _sendTokens(
        address token,
        uint256 amount,
        address receiver
    ) internal {
        require(amount > 0, "ZERO_AMOUNT");

        IERC20(token).safeTransfer(receiver, amount);
    }

    function _sendMOVR(uint256 amount, address payable recipient) internal {
        require(
            address(this).balance >= amount,
            "Address: insufficient balance"
        );

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "SEND_VALUE_FAIL");
    }

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
