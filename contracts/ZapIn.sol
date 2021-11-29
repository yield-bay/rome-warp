//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarFactory.sol";
import "./interface/solarbeam/ISolarPair.sol";
import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/IERC20.sol";
import "./interface/solarbeam/IWETH.sol";

contract ZapIn {
  ISolarRouter02 public solarRouter;
  ISolarFactory public solarFactory;
  address public wMOVR;
  

  constructor(address _router, address _factory, address _wMOVR) { 
    SolarRouter = ISolarRouter02(_router);
    SolarFactory = ISolarFactory(_factory);
    wMOVR = _wMOVR;
  }

  // Based on the approach documented here: https://hackmd.io/@oaoDb2ChTHidBQox6JlJ7g/rkO1bDytY
  function ZapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought) public returns (uint256 LPBought) {

    _transferTokenToContract(fromToken, amountToTransfer);

    LPBought = _zapIn(fromToken, toPool, amountToZap);

    // Revert is LPBought is lesser than minimumLPBought due to high slippage.
    require(LPBought >= minimumLPBought, "HIGH_SLIPPAGE");
  }

  function _zapIn(address fromToken, address toPool, uint256 amountToZap) internal returns (uint256 LPBought) {

    // Find the tokens in the pair.
    (address token0, address token1) = _fetchTokensFromPair(toPool);

    // Swap to intermediate token
    (address intermediate, uint256 intermediateAmount) = _convertToIntermediate(fromToken, token0, token1, amountToZap);


    // Swap intermediate token to token0, and token1. 

    // Deposit liquidity in SolarBeam
    
    // to silence errors while the function is WIP
    LPBought = 0;
  }  

  function _convertToIntermediate(address from,address token0, address token1, uint256 amount) internal returns (address intermediateToken,uint256 intermediateAmount) {
    intermediateToken = _findIntermediate(from, token0, token1);

    if(from == address(0) && intermediateToken == wMOVR) {
      IWETH(wMOVR).deposit{value: amount}();
      return;
    }

    if(from == intermediateToken) {
      intermediateAmount = amount;
      return;
    }

    intermediateAmount= _swapTokens(from, intermediateToken, amount);

    
  }

  function _findIntermediate(address fromToken, address token0, address token1) internal view returns (address intermediate) {
    if(fromToken == address(0)) {
      intermediate = wMOVR;
    } else {
      if(token0 == fromToken || token1 == fromToken) {
        intermediate = fromToken;
      } else {
        intermediate = wMOVR;
      }
    }
  }

  function _transferTokenToContract(address fromToken, uint256 amountToTransfer) internal {
    require(amountToTransfer > 0, "INVALID_AMOUNT");
    // If fromToken is zero address, transfer $MOVR
    if(fromToken == address(0)) {
      require(amountToTransfer == msg.value, "MOVR_NEQ_AMOUNT");      
      return;
    }

    IERC20Solar(fromToken).transferFrom(msg.sender, address(this), amountToTransfer);
  }

  function _fetchTokensFromPair(address pair) internal returns (address token0, address token1) {
    ISolarPair solarPair = ISolarPair(pair);

    token0 = solarPair.token0();
    token1 = solarPair.token1();
  }
  
  function _approveToken(
        address token,
        address spender,
        uint256 amount
    ) internal {
        IERC20(token).safeApprove(spender, 0);
        IERC20(token).safeApprove(spender, amount);
    }

  function _swapTokens(address from, address to, uint256 amount) internal returns (uint256 amountBought) {
    
    address pair = solarFactory.getPair(token0, token1);
    require(pair != address(0), "NO_PAIR");

    address[] memory path = new address[](2);
    path[0] = from;
    path[1] = to;

    _approveToken(from, address(solarRouter), amount);

    (, amountBought) = solarRouter.swapExactTokensForTokens(amount, 1, path, address(this), block.timestamp);
    require(amountBought > 0, "SWAP_FAILED");
  }

}



