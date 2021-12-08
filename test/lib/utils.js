const { ethers } = require("hardhat");

const SolarPair = require("../../artifacts/contracts/interface/solarbeam/ISolarPair.sol/ISolarPair.json");
const SolarERC20 = require("../../artifacts/contracts/interface/solarbeam/ISolarERC20.sol/ISolarERC20.json");

const SOLAR_FEE = 25;

async function calculateMinimumLP(pair, amount0, amount1, slippage) {
  /**
   * LP Tokens received ->
   * Minimum of the following -
   *  1. (amount0 * totalSupply) / reserve0
   *  2. (amount1 * totalSupply) / reserve1
   */

  const { reserve0, reserve1 } = await pair.getReserves();
  const totalSupply = await pair.totalSupply();

  const value0 = amount0.mul(totalSupply).div(reserve0);
  const value1 = amount1.mul(totalSupply).div(reserve1);

  const minLP = value0.lt(value1) ? value0 : value1;

  // `slippage` should be a number between 0 & 100.
  return minLP.mul(100 - slippage).div(100);
}

function sortTokens(token0, token1) {
  return token0 < token1 ? [token0, token1] : [token1, token0];
}

function makePair(PAIR_ADDRESS) {
  return new ethers.Contract(PAIR_ADDRESS, SolarPair.abi, ethers.provider);
}

function makeToken(TOKEN) {
  return new ethers.Contract(TOKEN, SolarERC20.abi, ethers.provider);
}

async function getAmountsOut(router, amount, path) {
  const amountsOut = await router.getAmountsOut(amount, path, SOLAR_FEE);
  return amountsOut[path.length - 1];
}

module.exports = {
  calculateMinimumLP,
  sortTokens,
  makeToken,
  makePair,
  getAmountsOut,
};
