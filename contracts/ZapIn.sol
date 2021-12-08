//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/IWETH.sol";

import "./base/ZapBase.sol";

import "hardhat/console.sol";



contract ZapInV1 is ZapBaseV1 {

  // SolarBeam contracts
  ISolarRouter02 public solarRouter;
  ISolarFactory public solarFactory;
  
  address public wMOVR;
  

  constructor(address _router, address _factory, address _wMOVR) { 
    solarRouter = ISolarRouter02(_router);
    solarFactory = ISolarFactory(_factory);
    wMOVR = _wMOVR;
  }

  // Based on the approach documented here: https://hackmd.io/@oaoDb2ChTHidBQox6JlJ7g/rkO1bDytY
  function zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought) public payable returns (uint256 LPBought) {
    
    // transfer the user's address to the contract
    _transferTokenToContract(fromToken, amountToZap);

    // Zap in from `fromToken`, to `toPool`.
    LPBought = _zapIn(fromToken, toPool, amountToZap);
    console.log("Minimum LP was: %s", minimumLPBought);
    console.log("LP Bought: %s", LPBought);

    // Revert is LPBought is lesser than minimumLPBought due to high slippage.
    require(LPBought >= minimumLPBought, "HIGH_SLIPPAGE");
  }

  function _zapIn(address fromToken, address toPool, uint256 amountToZap) internal returns (uint256) {

    // Find the tokens in the pair.
    (address token0, address token1) = _fetchTokensFromPair(toPool);
    

    // Swap to intermediate token
    (address intermediate, uint256 intermediateAmount) = _convertToIntermediate(fromToken, token0, token1, amountToZap);
    // console.log("Intermediate is %s", intermediate);
    // console.log("Intermediate amount is %s", intermediateAmount);
    
    
    // Swap intermediate token to token0, and token1.
    (uint256 token0Amount, uint256 token1Amount) = _swapIntermediateToTarget(intermediate, token0, token1, intermediateAmount);
    // console.log("Token0: %s; Token1: %s", token0Amount, token1Amount);
    

    // Add liquidity
    return _addLiquidityForPair(token0, token1, token0Amount, token1Amount);
  }  

  function _addLiquidityForPair(address token0, address token1, uint256 token0Amount, uint256 token1Amount) internal returns (uint256) {
    // Approve the tokens
    _approveToken(token0, address(solarRouter), token0Amount);
    _approveToken(token1, address(solarRouter), token1Amount);


    // Add liquidity to the token0 & token1 pair
    (uint256 amount0, uint256 amount1, uint256 LPBought) = solarRouter.addLiquidity(token0, token1, token0Amount, token1Amount, 1, 1, msg.sender, block.timestamp);
    

    // Transfer the residual token0 amount back to the user
    if(token0Amount - amount0 > 0) {
      IERC20Solar(token0).transfer(msg.sender, token0Amount - amount0);
    }

    // Transfer the residual token1 amount back to the user
    if(token1Amount - amount1 > 0){
      IERC20Solar(token1).transfer(msg.sender, token1Amount - amount1);
    }

    return LPBought;
  }

  function _swapIntermediateToTarget(address from, address token0, address token1, uint256 amount) internal returns(uint256 token0Amount, uint256 token1Amount) {
    require(token0 != token1, "TOKEN0_TOKEN1_SAME");

    // Swap half of amount to token0, and rest half to token1
    if(from == token0){
      token0Amount = amount / 2;
    } else {
      token0Amount = _swapTokens(from, token0, amount / 2);
    }

    if(from == token1) {
      token1Amount = amount / 2;
    } else {
      token1Amount = _swapTokens(from, token1, amount / 2);
    }
  }

  function _convertToIntermediate(address from,address token0, address token1, uint256 amount) internal returns (address intermediateToken,uint256 intermediateAmount) {
    // Intermediate token is the one the zap is routed through. 
    intermediateToken = _findIntermediate(from, token0, token1);
    
    // If from is address(0), it is $MOVR. 
    if(from == address(0) && intermediateToken == wMOVR) {
      // Convert $MOVR to $wMOVR
      IWETH(wMOVR).deposit{value: amount}();
      intermediateAmount = amount;
    }
    else if(from == intermediateToken) {
      // If `from` is the same as `intermediateToken`: `from` is the intermediate.
      intermediateAmount = amount;
    } else {
      // Convert `from` to the `intermediateToken`
      intermediateAmount= _swapTokens(from, intermediateToken, amount);
    }
  }

  

  
  
  


  function _swapTokens(address from, address to, uint256 amount) internal returns (uint256 amountBought) {
    // Find the pair address of the tokens that need to be swapped between.
    
    address pair = solarFactory.getPair(from, to);
    // If address is 0, no pair exists for the tokens.
    require(pair != address(0), "NO_PAIR");
    

    // Path for the swap.
    address[] memory path = new address[](2);
    path[0] = from;
    path[1] = to;

    // Approve the solarRouter to spend the contract's `from` token.
    _approveToken(from, address(solarRouter), amount);

    // Swap the tokens through solarRouter
    amountBought = solarRouter.swapExactTokensForTokens(amount, 1, path, address(this), block.timestamp)[path.length - 1];
    require(amountBought > 0, "SWAP_FAILED");
  }

  function _findIntermediate(address from, address token0, address token1) internal view returns (address intermediate) {
    if(from == address(0)) {
      intermediate = wMOVR;
    } else {
      if(token0 == from || token1 == from) {
        intermediate = from;
      } else {
        intermediate = wMOVR;
      }
    }
  }

  

}




