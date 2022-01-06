// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interface/solarbeam/IWETH.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarRouter02.sol";

import "./interface/romedao/IStaking.sol";
// import "./interface/romedao/IERC20.sol";

import "./base/WarpBase.sol";

import "hardhat/console.sol";

/// @author Nightwing from Yieldbay
/// @notice Implements the mechanism to add liquidity to any solarbeam.io liquidity pool from any ERC20 token or $MOVR.
/// @notice Lets you add liquidity from your preferred token in one transaction.
contract WarpInV1 is WarpBaseV1 {
    // SolarBeam contracts
    ISolarRouter02 public immutable solarRouter;
    ISolarFactory public immutable solarFactory;

    IStaking public immutable romeStakingHelper;

    address public immutable wMOVR;
    address public immutable ROME;
    address public immutable sROME;

    event WarpedIn(
        address sender,
        address indexed from,
        address indexed pool,
        uint256 amountToWarp,
        uint256 lpReceived
    );

    event StakedROME(
        address sender,
        address indexed from,
        address indexed pool,
        uint256 amountToWarp,
        uint256 lpReceived
    );

    constructor(
        address _router,
        address _factory,
        address _romeStakingHelper,
        address _wMOVR,
        address _ROME,
        address _sROME
    ) {
        require(
            _router != address(0) &&
                _factory != address(0) &&
                _wMOVR != address(0),
            "ZERO_ADDRESS"
        );
        solarRouter = ISolarRouter02(_router);
        solarFactory = ISolarFactory(_factory);
        romeStakingHelper = IStaking(_romeStakingHelper);
        wMOVR = _wMOVR;
        ROME = _ROME;
        sROME = _sROME;
    }

    function warpIn(
        address fromToken,
        // address toToken,
        uint256 amountToWarp,
        uint256 minimumTokenBought,
        address[] memory path
        // address[] memory path0,
        // address[] memory path1
    ) external payable notPaused returns (uint256) {
        // require(toToken != address(0), "ZERO_ADDRESS");
        require(amountToWarp > 0 && minimumTokenBought > 0, "ZERO_AMOUNT");

        // transfer the user's address to the contract
        _getTokens(fromToken, amountToWarp);

        // Warp-in from `fromToken`, to `toToken`.
        (uint256 tokenBought, bool staked) = _warpIn(fromToken, ROME, amountToWarp, path, msg.sender);
        console.log("Minimum tokens were: %s", minimumTokenBought);
        console.log("Tokens Bought: %s", tokenBought);

        // Revert is tokenBought is lesser than minimumTokenBought due to high slippage.
        require(tokenBought >= minimumTokenBought, "HIGH_SLIPPAGE");

        emit WarpedIn(msg.sender, fromToken, ROME, amountToWarp, tokenBought);
        if (staked) {
            emit StakedROME(msg.sender, fromToken, sROME, amountToWarp, tokenBought);   
        }
        return tokenBought;
    }

    function _warpIn(
        address from,
        address to,
        // address pool,
        uint256 amount,
        address[] memory path,
        address user
        // address[] memory path0,
        // address[] memory path1
    ) internal returns (uint256, bool) {
        uint256 amountBought =  _convertToken(from, to, amount, path);
        bool staked = _stakeToken(amountBought, user);
        return (amountBought, staked);
        // (address token0, address token1) = _fetchTokensFromPair(pool);

        // (uint256 amount0, uint256 amount1) = _convertToTargetTokens(
        //     from,
        //     token0,
        //     token1,
        //     amount,
        //     path0,
        //     path1
        // );

        // return _addLiquidityForPair(token0, token1, amount0, amount1);
    }

    /// @notice Converts the `from` token to `token0` and `token1`.
    /// @notice By the end of it, the contract has the correct amounts of token0 and token1 required to add liquidity to the desired pool.
    /// @dev if `from` is address(0), represents $MOVR.
    /// @dev path0 is an empty array if `from` == `token0`; Because no need to convert `from` to `token0` in that case.
    /// @dev path1 is an empty array if `from` == `token1`; Because no need to convert `from` to `token1` in that case.
    /// @param from address of the token to add liquidity with.
    /// @param token0 address of the first token in the pool.
    /// @param token1 address of the second token in the pool.
    /// @param path0 an array of addresses that represent the swap path for token0 in `toPool`; Calculated off-chain.
    /// @param path1 an array of addresses that represent the swap path for token1 in `toPool`; Calculated off-chain.
    /// @return amount0 amount of `token0` to add liquidity with.
    /// @return amount1 amount of `token1` to add liquidity with.
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

    /// @notice Converts `amount` of `from` token to `to` token.
    /// @dev Explain to a developer any extra details
    /// @dev path is an empty array when - `from` is $MOVR and `to` is $WMOVR.
    /// @param from address of starting token.
    /// @param to address of the destination token.
    /// @param path array of addresses that represent the swap path to swap `from` with `to`
    /// @return amount of `to` token acquired by the contract.
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

    function _stakeToken(uint256 _amount, address user) internal returns (bool) {
        return romeStakingHelper.stake(_amount, user);
    }

    /// @notice Adds liquidity to the liquidity pool that exists between `token0` and `token1`
    /// @dev Also, sends back to the msg.sender the residual amount of token0 and token1 left after adding liquidity.
    /// @param token0 address of the first token in the pair.
    /// @param token1 address of the second token in the pair.
    /// @param token0Amount amount of token0 to add liquidity with.
    /// @param token1Amount amount of token1 to add liquidity with.
    /// @return amount of LP tokens received by adding liquidity.
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

    /// @notice Swaps `from` token to `to` token through the solarbeam DEX
    /// @dev Explain to a developer any extra details
    /// @param from address of the starting token.
    /// @param to address of the destination token.
    /// @param amount amount of `from` token to swap.
    /// @param path an array of addresses that represent the swap path for `to` token; Calculated off-chain.
    /// @return amountBought the amount of `to` token received from the swap.
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

    /// @notice Returns the residual tokens left after adding liquidity to the user.
    /// @param token address of the token to check for residue and send.
    /// @param initialAmount amount of `token` before it was used to add liquidity.
    /// @param amountUsed amount of `token` used to add liquidity.
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
