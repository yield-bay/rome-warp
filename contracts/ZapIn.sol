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
  IWETH public wMOVR;
  

  constructor(address _router, address _factory, address _wMOVR) { 
    SolarRouter = ISolarRouter02(_router);
    SolarFactory = ISolarFactory(_factory);
    wMOVR = IWETH(_wMOVR);
  }

  // Based on the approach documented here: https://hackmd.io/@oaoDb2ChTHidBQox6JlJ7g/rkO1bDytY
  function ZapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought) public returns (uint256 LPBought) {

    _transferTokenToContract(fromToken, amountToTransfer);

    LPBought = _zapIn(fromToken, toPool, amountToZap);

    // Revert is LPBought is lesser than minimumLPBought due to high slippage.
    require(LPBought >= minimumLPBought, "HIGH_SLIPPAGE");
  }

  function _zapIn(address fromToken, address toPool, uint256 amountToZap) returns (uint256 LPBought) {

    // 1. Find the tokens in the pair.
    // (address token0, address token1) = _fetchTokensFromPair(toPool);

    // 2. Calculate the intermediate token.


    // 3. Swap to intermediate token.


    // 4. Swap intermediate token to token0, and token1. 

    // 5. Deposit liquidity in SolarBeam
    
    // to silence errors while the function is WIP
    LPBought = 0;
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
  

}

