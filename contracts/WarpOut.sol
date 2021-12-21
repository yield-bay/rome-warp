// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/IWETH.sol";

import "./base/WarpBase.sol";

import "hardhat/console.sol";

/// @author Nightwing from Yieldbay
/// @notice Implements the mechanism to remove liquidity from any solarbeam.io liquidity pool, and receive the burned LP tokens in either one of - $MOVR, `token0`, or `token1`. `token0` and `token1` stand for tokens in the pool.
/// @dev In one transaction, remove liquidity from any solarbeam pool and receive either $MOVR, token0, or token1 of similar value.
contract WarpOutV1 is WarpBaseV1 {
    ISolarRouter02 public immutable solarRouter;
    address public immutable wMOVR;

    /// @notice Event to signify a `warpOut`.
    /// @dev Emmited when liquidity is successfully remove from the pool, and the `target` token is sent to the `sender`.
    /// @dev `target` can either be zero address(stands for MOVR), or one of the tokens present in the `pool`.
    /// @param sender address of the entity that called `warpOut`
    /// @param pool address of the pool to remove the liquidity from.
    /// @param target address of the target token that the `sender` choosed to receive the liquidity in.
    /// @param LPAmount amount of liquidity to remove from the `pool`.
    /// @param targetAmount amount of `target` tokens sent to the user after removing liquidity.
    event WarpedOut(
        address sender,
        address indexed pool,
        address indexed target,
        uint256 LPAmount,
        uint256 targetAmount
    );

    constructor(address _router, address _wMOVR) {
        require(_router != address(0) && _wMOVR != address(0), "ZERO_ADDRESS");
        solarRouter = ISolarRouter02(_router);
        wMOVR = _wMOVR;
    }

    /// @notice Function to remove liquidity and convert it to the target token.
    /// @dev if `to` is address(0), represents $MOVR.
    /// @param fromLP address of the pool to remove the liquidity from.
    /// @param to address of the target token.
    /// @param lpAmount amount of liquidity to remove from `fromLP`.
    /// @param path0 an array of addresses that represent the swap path for token0 in `fromLP`; Calculated off-chain.
    /// @param path1 an array of addresses that represent the swap path for token1 in `fromLP`; Calculated off-chain.
    /// @return amountReceived amount of `to` tokens received.
    function warpOut(
        address fromLP,
        address to,
        uint256 lpAmount,
        address[] memory path0,
        address[] memory path1
    ) external notPaused returns (uint256 amountReceived) {
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

    /// @notice Removes liquidity from `pool` of amount `lpAmount`
    /// @dev Explain to a developer any extra details
    /// @param pool address of the liquidity pool to remove the liquidity from.
    /// @param token0 address of the first token in the liquidity pool.
    /// @param token1 address of the second token in the liquidity pool.
    /// @param lpAmount amount of liquidity to remove from `pool`.
    /// @return amount0 amount of token0 received from removing liquidity.
    /// @return amount1 amount of token1 received from removing liquidity.
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

    /// @notice Explain to an end user what this does
    /// @dev path0 is an empty array if token0 == target
    /// @dev path1 is an empty array if token1 == target
    /// @dev `target` can't be zero address.
    /// @dev `target` must be either `token0` or `token1`.
    /// @param token0 address of the first token to convert to `target`.
    /// @param token1 address of the second token to convert to `target`.
    /// @param target address of the destination token.
    /// @param amount0 amount of `token0`
    /// @param amount1 amount of `token1`
    /// @param path0 an array of addresses that represent the swap path for token0 to `target`; Calculated off-chain.
    /// @param path1 an array of addresses that represent the swap path for token1 to `target`; Calculated off-chain.
    /// @return amount final amount of target token.
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

    /// @notice Converts ERC-20 tokens, token0 & token1, to $MOVR.
    /// @dev Explain to a developer any extra details
    /// @param token0 address of the first token to be converted to $MOVR.
    /// @param token1 address of the second token to be converted to $MOVR.
    /// @param amount0 amount of `token0` to be converted to $MOVR.
    /// @param amount1 amount of `token1` to be converted to $MOVR.
    /// @param path0 an array of addresses that represent the swap path from token0 to $MOVR; Calculated off-chain.
    /// @param path1 an array of addresses that represent the swap path from token1 to $MOVR; Calculated off-chain.
    /// @return amount of $MOVR received by the contract from converting `token0` and `token1` to $MOVR through the solarbeam DEX
    function _swapTokensToMOVR(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        address[] memory path0,
        address[] memory path1
    ) internal returns (uint256) {
        return
            _swapToMOVR(token0, amount0, path0) +
            _swapToMOVR(token1, amount1, path1);
    }

    /// @notice Converts an ERC-20 token to $MOVR.
    /// @dev `path` is an empty array if token == wMOVR.
    /// @dev if `token` is wMOVR, token is not swapped, but withdrawn from the WMOVR contract.
    /// @param token address of the token to swap to $MOVR.
    /// @param amount amount of `token` to swap to $MOVR.
    /// @param path an array of addresses that represent the swap path from `token` to $MOVR; Calculated off-chain.
    /// @return movrAmount amount of $MOVR received by the contract by swapping `amount` of `token` to $MOVR.
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

    /// @notice Performs a swap between two ERC-20 tokens.
    /// @dev Explain to a developer any extra details
    /// @param from address of the token to swap.
    /// @param to address of the destination token.
    /// @param amount amount of `from` token to swap.
    /// @param path an array of addresses that represent the swap path from `from` to `to`; Calculated off-chain.
    /// @return amountBought amount of `to` token received by swapping the `from` token.
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
