//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interface/solarbeam/ISolarRouter02.sol";
import "./interface/solarbeam/ISolarFactory.sol";


contract ZapIn {
  ISolarRouter02 public solarRouter;
  ISolarFactory public solarFactory;

  constructor(address _router, address _factory) { 
    SolarRouter = ISolarRouter02(_router);
    SolarFactory = ISolarFactory(_factory);
  }

  function ZapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought) public returns (uint256 LPBought) {
    LPBought = 0;
    // Revert is LPBought is lesser than minimumLPBought due to high slippage.
    require(LPBought >= minimumLPBought, "HIGH_SLIPPAGE");
  }
  

}

