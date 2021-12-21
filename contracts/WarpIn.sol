//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interface/solarbeam/IWETH.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarRouter02.sol";

import "./base/WarpBase.sol";

import "hardhat/console.sol";

contract WarpInV1 is WarpBaseV1 {
    // SolarBeam contracts
    ISolarRouter02 public immutable solarRouter;
    ISolarFactory public immutable solarFactory;

    address public immutable wMOVR;

    event WarpedIn(
        address sender,
        address indexed from,
        address indexed pool,
        uint256 amountToWarp,
        uint256 lpReceived
    );

    constructor(
        address _router,
        address _factory,
        address _wMOVR
    ) {
        require(
            _router != address(0) ||
                _factory != address(0) ||
                _wMOVR != address(0),
            "ZERO_ADDRESS"
        );
        solarRouter = ISolarRouter02(_router);
        solarFactory = ISolarFactory(_factory);
        wMOVR = _wMOVR;
    }

    function warpIn(
        address fromToken,
        address toPool,
        uint256 amountToWarp,
        uint256 minimumLPBought,
        address[] memory path0,
        address[] memory path1
    ) external payable notPaused returns (uint256 LPBought) {
        // transfer the user's address to the contract
        _getTokens(fromToken, amountToWarp);

        // Warp-in from `fromToken`, to `toPool`.
        LPBought = _warpIn(fromToken, toPool, amountToWarp, path0, path1);
        console.log("Minimum LP was: %s", minimumLPBought);
        console.log("LP Bought: %s", LPBought);

        // Revert is LPBought is lesser than minimumLPBought due to high slippage.
        require(LPBought >= minimumLPBought, "HIGH_SLIPPAGE");

        emit WarpedIn(msg.sender, fromToken, toPool, amountToWarp, LPBought);
    }

    function _warpIn(
        address from,
        address pool,
        uint256 amount,
        address[] memory path0,
        address[] memory path1
    ) internal returns (uint256) {
        (address token0, address token1) = _fetchTokensFromPair(pool);

        (uint256 amount0, uint256 amount1) = _convertToTargetTokens(
            from,
            token0,
            token1,
            amount,
            path0,
            path1
        );

        return _addLiquidityForPair(token0, token1, amount0, amount1);
    }

    function _convertToTargetTokens(
        address from,
        address token0,
        address token1,
        uint256 amount,
        address[] memory path0,
        address[] memory path1
    ) internal returns (uint256 amount0, uint256 amount1) {
        uint256 halfAmount = amount / 2;
        if (from == token0) {
            amount0 = halfAmount;
        } else {
            amount0 = _convertToken(from, token0, halfAmount, path0);
        }

        if (from == token1) {
            amount1 = halfAmount;
        } else {
            amount1 = _convertToken(from, token1, halfAmount, path1);
        }
    }

    function _convertToken(
        address from,
        address to,
        uint256 amount,
        address[] memory path
    ) internal returns (uint256) {
        if (from == address(0)) {
            IWETH(wMOVR).deposit{value: amount}();

            if (to == wMOVR) {
                return amount;
            }

            return _swapTokens(wMOVR, to, amount, path);
        }
        require(from != to, "INVALID_SWAP");
        return _swapTokens(from, to, amount, path);
    }

    function _addLiquidityForPair(
        address token0,
        address token1,
        uint256 token0Amount,
        uint256 token1Amount
    ) internal returns (uint256) {
        // Approve the tokens
        _approveToken(token0, address(solarRouter), token0Amount);
        _approveToken(token1, address(solarRouter), token1Amount);

        // Add liquidity to the token0 & token1 pair
        (uint256 amount0, uint256 amount1, uint256 LPBought) = solarRouter
            .addLiquidity(
                token0,
                token1,
                token0Amount,
                token1Amount,
                1,
                1,
                msg.sender,
                block.timestamp
            );

        _returnResidual(token0, token0Amount, amount0);
        _returnResidual(token1, token1Amount, amount1);

        return LPBought;
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

    function _returnResidual(
        address token,
        uint256 initialAmount,
        uint256 amountUsed
    ) internal {
        if (initialAmount - amountUsed > 0) {
            _sendTokens(token, initialAmount - amountUsed, msg.sender);
        }
    }
}
