// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/IWETH.sol";

import "./interface/romedao/IStaking.sol";

import "./base/WarpBase.sol";

import "hardhat/console.sol";

contract RomeWarpV1 is WarpBaseV1 {
    ISolarRouter02 public immutable solarRouter;

    /////////////// storage ///////////////

    address public immutable staking;
    address public immutable wMOVR;
    address public immutable ROME;
    address public immutable sROME;

    /////////////// Events ///////////////

    // Emitted when `sender` Warps In
    event WarpIn(address sender, address token, uint256 tokensRec);

    // Emitted when `sender` Warps Out
    event WarpOut(address sender, address token, uint256 tokensRec);

    /////////////// Construction ///////////////

    constructor(
        address _router,
        address _staking,
        address _wMOVR,
        address _ROME,
        address _sROME
    ) {
        require(
            _router != address(0) &&
                _staking != address(0) &&
                _wMOVR != address(0) &&
                _ROME != address(0) &&
                _sROME != address(0),
            "ZERO_ADDRESS"
        );
        solarRouter = ISolarRouter02(_router);
        staking = _staking;
        wMOVR = _wMOVR;
        ROME = _ROME;
        sROME = _sROME;
    }

    /// @notice Function to stake ROME from an arbitrary ERC-20 token, or $MOVR.
    /// @param fromToken address of the token to add liquidity with.
    /// @param amountIn amount of `fromToken` to add liquidity with.
    /// @param minToToken minimum amount of $sROME that should be received by staking $ROME; Calculated off-chain.
    /// @param path an array of addresses that represent the swap path from `fromToken` to $ROME; Calculated off-chain.
    function warpIn(
        address fromToken,
        uint256 amountIn,
        uint256 minToToken,
        address[] memory path
    ) external payable notPaused returns (uint256 ROMERec) {
        uint256 toInvest = _getTokens(fromToken, amountIn);

        uint256 tokensBought = _convertToken(fromToken, ROME, toInvest, path);

        bool staked;
        (staked, ROMERec) = _enterRome(tokensBought);
        if (!staked) {
            console.log("couldn't stake ROME");
        } else {
            console.log("_enterRome.ROMERec:", ROMERec);
            require(ROMERec > minToToken, "High Slippage");

            emit WarpIn(msg.sender, sROME, ROMERec);
        }
    }

    /// @notice Function to unstake $ROME and receive an arbitrary ERC-20 token, or $MOVR.
    /// @param amountOut amount to $ROME to unstake.
    /// @param toToken address of the target token.
    /// @param minToTokens minimum acceptable quantity of tokens to receive. Reverts otherwise.
    /// @param path an array of addresses that represent the swap path from $ROME to `toToken`; Calculated off-chain.
    function warpOut(
        uint256 amountOut,
        address toToken,
        uint256 minToTokens,
        address[] memory path
    ) external notPaused returns (uint256 tokensRec) {
        amountOut = _pullTokens(sROME, amountOut);
        uint256 ROMERec = _exitRome(amountOut);
        console.log("_exitRome.ROMERec", ROMERec);

        if (toToken == address(0)) {
            tokensRec = _swapToMOVR(ROME, ROMERec, path);
            require(tokensRec >= minToTokens, "High Slippage");
            _sendMOVR(tokensRec, payable(msg.sender));
        } else {
            tokensRec = _swapTokens(ROME, toToken, ROMERec, path);
            require(tokensRec >= minToTokens, "High Slippage");
            _sendTokens(toToken, tokensRec, msg.sender);
        }

        emit WarpOut(msg.sender, toToken, tokensRec);
    }

    function _enterRome(uint256 amount) internal returns (bool, uint256) {
        _approveToken(ROME, staking, amount);

        bool staked = IStaking(staking).stake(amount, msg.sender);
        if (staked) IStaking(staking).claim(msg.sender);

        return (staked, amount);
    }

    function _exitRome(uint256 amount) internal returns (uint256) {
        _approveToken(sROME, address(staking), amount);

        IStaking(staking).unstake(amount, true);

        return amount;
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
