const { expect } = require("chai");
const { ethers } = require("hardhat");
const BN = require("bn.js");

const SolarERC20 = require("../artifacts/contracts/interface/solarbeam/ISolarERC20.sol/ISolarERC20.json");
const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const SolarPair = require("../artifacts/contracts/interface/solarbeam/ISolarPair.sol/ISolarPair.json");

// SolarBeam addresses
const ROUTER = "0xAA30eF758139ae4a7f798112902Bf6d65612045f";
const FACTORY = "0x049581aEB6Fe262727f290165C29BDAB065a1B68";

// Tokens
const WMOVR = "0x98878b06940ae243284ca214f92bb71a2b032b8a";
const FRAX = "0x1a93b23281cc1cde4c4741353f3064709a16197d";

const SOLAR_FEE = 25;

describe("ZapInV1 Test", function () {
  let ZapIn;
  let router;
  let factory;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const ZapInFactory = await ethers.getContractFactory("ZapInV1");
    ZapIn = await ZapInFactory.deploy(ROUTER, FACTORY, WMOVR);

    await ZapIn.deployed();

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
  });

  it("ZapIn from $MOVR to WMOVR-FRAX LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
    const LP_PAIR = makePair(PAIR_ADDRESS);

    /**
     * 1. Find estimate of token0: wMOVR
     * 2. Find estimate of token1: FRAX
     */

    const amountToInvest = ethers.BigNumber.from(
      ethers.utils.parseEther("0.002")
    );

    // Find MOVR <> FRAX
    const MOVR_FRAX_PATH = [WMOVR, FRAX];
    const token0Amount = await getAmountsOut(
      router,
      amountToInvest.div(2),
      MOVR_FRAX_PATH
    );

    // As $MOVR gets converted to $WMOVR 1:1
    const token1Amount = amountToInvest.div(2);

    const minLP = await calculateMinimumLP(
      LP_PAIR,
      token0Amount,
      token1Amount,
      3
    );

    console.log(
      `Signer LP Balance before tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );
    // zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought)
    const tx = await ZapIn.zapIn(
      ethers.constants.AddressZero,
      PAIR_ADDRESS,
      amountToInvest,
      minLP,
      { value: amountToInvest }
    );

    console.log(
      `Signer LP Balance after tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );
  });

  it("ZapIn from $FRAX to WMOVR-FRAX LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
    const LP_PAIR = makePair(PAIR_ADDRESS);
    // $MOVR amount to invest.
    const amountToInvest = ethers.BigNumber.from(
      ethers.utils.parseEther("0.002")
    );

    // Convert $MOVR to $FRAX
    await router
      .connect(signer)
      .swapExactETHForTokens(1, [WMOVR, FRAX], signer.address, "1638921156", {
        value: amountToInvest,
      });

    // FRAX token address
    const FraxToken = makeToken(FRAX);

    let fraxBalance = await FraxToken.balanceOf(signer.address);
    console.log("Signer's $FRAX Balance: ", fraxBalance.toString());

    // Individual token amounts to invest
    const amount0 = fraxBalance.div(2);
    const amount1 = await getAmountsOut(router, fraxBalance.div(2), [
      FRAX,
      WMOVR,
    ]);

    const minLP = await calculateMinimumLP(LP_PAIR, amount0, amount1, 3);

    console.log(
      `Signer LP Balance before tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );

    // Approve the ZapIn contract to spend the users' $FRAX
    await FraxToken.connect(signer).approve(ZapIn.address, fraxBalance);
    // zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought)
    await ZapIn.zapIn(FRAX, PAIR_ADDRESS, fraxBalance, minLP);

    console.log(
      `Signer LP Balance after tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );
    fraxBalance = await FraxToken.balanceOf(signer.address);
    console.log("Signer's $FRAX Balance after ZapIn: ", fraxBalance.toString());
  });
});

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

function sortTokens(token0, token1) {
  return token0 < token1 ? [token0, token1] : [token1, token0];
}
