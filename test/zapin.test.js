const { expect } = require("chai");
const { ethers } = require("hardhat");

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
const MATIC = "0x682f81e57eaa716504090c3ecba8595fb54561d8";
const SOLAR = "0x6bD193Ee6D2104F14F94E2cA6efefae561A4334B";
const BNB = "0x2bf9b864cdc97b08b6d79ad4663e71b8ab65c45c";
const BUSD = "0x5d9ab5522c64e1f6ef5e3627eccc093f56167818";

const SOLAR_FEE = 25;

/**
 * Condition for selecting tokens
 * • Both the tokens in the pool should've a direct route with MOVR
 * • Token you're zapping in from, should've a direct route with MOVR
 */

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

  // TODO
  it("ZapIn from $MOVR to BNB-BUSD LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(BNB, BUSD);
    const LP_PAIR = makePair(PAIR_ADDRESS);
    // $MOVR amount to invest.
    const movrToInvest = ethers.BigNumber.from(ethers.utils.parseEther("20"));
    const amountsOut = {};
    amountsOut[BNB] = await getAmountsOut(router, movrToInvest.div(2), [
      WMOVR,
      BNB,
    ]);

    amountsOut[BUSD] = await getAmountsOut(router, movrToInvest.div(2), [
      WMOVR,
      BUSD,
    ]);

    console.log("BNB Amount", amountsOut[BNB].toString());
    console.log("BUSD Amount", amountsOut[BUSD].toString());
    const tokens = sortTokens(BNB, BUSD);
    const minLP = await calculateMinimumLP(
      LP_PAIR,
      amountsOut[tokens[0]],
      amountsOut[tokens[1]],
      5
    );
    // zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought)
    let lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("LP Balance before Zap", lpBalance.toString());
    await ZapIn.zapIn(
      ethers.constants.AddressZero,
      PAIR_ADDRESS,
      movrToInvest,
      minLP,
      { value: movrToInvest }
    );

    lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("LP Balance after the Zap", lpBalance.toString());
  });

  // TODO
  it("ZapIn from $MATIC to WMOVR-FRAX LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
    const LP_PAIR = makePair(PAIR_ADDRESS);

    const movrToInvest = ethers.BigNumber.from(
      ethers.utils.parseEther("0.002")
    );

    await router
      .connect(signer)
      .swapExactETHForTokens(1, [WMOVR, MATIC], signer.address, "1638921156", {
        value: movrToInvest,
      });

    const Matic = makeToken(MATIC);

    let maticBalance = await Matic.balanceOf(signer.address);

    const amountsOut = {};

    amountsOut[WMOVR] = await getAmountsOut(router, maticBalance.div(2), [
      MATIC,
      WMOVR,
    ]);

    amountsOut[FRAX] = await getAmountsOut(router, maticBalance.div(2), [
      MATIC,
      WMOVR,
      FRAX,
    ]);
    const tokens = sortTokens(WMOVR, FRAX);

    const minLP = await calculateMinimumLP(
      LP_PAIR,
      amountsOut[tokens[0]],
      amountsOut[tokens[1]],
      5
    );

    let lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("MATIC balance before zap:", maticBalance.toString());
    console.log(`LP Balance before zap: ${lpBalance.toString()}`);
    await Matic.connect(signer).approve(ZapIn.address, maticBalance);
    // zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought)
    await ZapIn.zapIn(MATIC, PAIR_ADDRESS, maticBalance, minLP);
    lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log(`LP Balance after zap: ${lpBalance.toString()}`);

    maticBalance = await Matic.balanceOf(signer.address);
    console.log(`MATIC Balance after zap: ${maticBalance.toString()}`);
  });

  // TODO
  // it("ZapIn from $USDC to FRAX-ROME LP", async () => {});
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
