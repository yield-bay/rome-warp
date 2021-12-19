//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/IWETH.sol";

import "./base/WarpBase.sol";

import "hardhat/console.sol";

contract WarpOutV1 is WarpBaseV1 {
    ISolarRouter02 public solarRouter;
    address public wMOVR;

    event WarpedOut(
        address sender,
        address indexed pool,
        address indexed target,
        uint256 LPAmount,
        uint256 targetAmount
    );

    constructor(address _router, address _wMOVR) {
        solarRouter = ISolarRouter02(_router);
        wMOVR = _wMOVR;
    }

    function warpOut(
        address fromLP,
        address to,
        uint256 lpAmount,
        address[] memory path0,
        address[] memory path1
    ) public notPaused returns (uint256 amountReceived) {
        require(lpAmount > 0, "ZERO_AMOUNT");
        (address token0, address token1) = _fetchTokensFromPair(fromLP);

        // Verify the destination is valid.
        require(
            to == address(0) || to == token0 || to == token1,
            "DESTINATION_INVALID"
        );

        (uint256 amount0, uint256 amount1) = _removeLiquidity(
            fromLP,
            token0,
            token1,
            lpAmount
        );

        if (to == address(0)) {
            amountReceived = _swapTokensToMOVR(
                token0,
                token1,
                amount0,
                amount1,
                path0,
                path1
            );
            console.log("MOVR Amount: %s", amountReceived);
            _sendMOVR(amountReceived, payable(msg.sender));
        } else {
            amountReceived = _swapToTargetToken(
                token0,
                token1,
                to,
                amount0,
                amount1,
                path0,
                path1
            );
            console.log("Token Amount: %s", amountReceived);
            _sendTokens(to, amountReceived, msg.sender);
        }

        emit WarpedOut(msg.sender, fromLP, to, lpAmount, amountReceived);
    }

    function _removeLiquidity(
        address pool,
        address token0,
        address token1,
        uint256 lpAmount
    ) internal returns (uint256 amount0, uint256 amount1) {
        _getTokens(pool, lpAmount);
        _approveToken(pool, address(solarRouter), lpAmount);

        (amount0, amount1) = solarRouter.removeLiquidity(
            token0,
            token1,
            lpAmount,
            1,
            1,
            address(this),
            block.timestamp
        );
        require(amount0 > 0 && amount1 > 0, "INCORRECT_REMOVE_LIQ");
    }

    function _swapToTargetToken(
        address token0,
        address token1,
        address target,
        uint256 amount0,
        uint256 amount1,
        address[] memory path0,
        address[] memory path1
    ) internal returns (uint256 amount) {
        require(target == token0 || target == token1, "DESTINATION_INVALID");
        if (target == token0) {
            amount = amount0;
            amount += _swapTokens(token1, token0, amount1, path1);
        } else {
            // target == token1
            amount = amount1;
            amount += _swapTokens(token0, token1, amount0, path0);
        }
    }

    function _swapTokensToMOVR(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        address[] memory path0,
        address[] memory path1
    ) internal returns (uint256) {
        uint256 movrAmount1 = _swapToMOVR(token0, amount0, path0);
        uint256 movrAmount2 = _swapToMOVR(token1, amount1, path1);

        return movrAmount1 + movrAmount2;
    }

    function _swapToMOVR(
        address token,
        uint256 amount,
        address[] memory path
    ) internal returns (uint256 movrAmount) {
        require(amount > 0, "AMOUNT_ZERO");
        if (token == wMOVR) {
            IWETH(wMOVR).withdraw(amount);
            movrAmount = amount;
        } else {
            _approveToken(token, address(solarRouter), amount);
            movrAmount = solarRouter.swapExactTokensForETH(
                amount,
                1,
                path,
                address(this),
                block.timestamp
            )[path.length - 1];
        }

        require(movrAmount > 0, "MOVR_AMOUNT_ZERO");
    }

    function _swapTokens(
        address from,
        address to,
        uint256 amount,
        address[] memory path
    ) internal returns (uint256 amountBought) {
        require(from != to, "INVALID_SWAP");

        // Approve the solarRouter to spend the contract's `from` token.
        _approveToken(from, address(solarRouter), amount);

        // Swap the tokens through solarRouter
        amountBought = solarRouter.swapExactTokensForTokens(
            amount,
            1,
            path,
            address(this),
            block.timestamp
        )[path.length - 1];
        require(amountBought > 0, "SWAP_FAILED");
    }

    // to receive $MOVR
    receive() external payable {}
}
