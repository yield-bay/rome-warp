const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  calculateMinimumLP,
  sortTokens,
  makePair,
  makeToken,
  getAmountsOut,
} = require("./lib/utils.js");

const {
  ROUTER,
  FACTORY,
  WMOVR,
  FRAX,
  MATIC,
  BNB,
  BUSD,
} = require("./lib/constants");

const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");

const deadline = "1922966168";

describe("WarpInV1 Test", function () {
  let WarpIn;
  let router;
  let factory;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const WarpInFactory = await ethers.getContractFactory("WarpInV1");
    WarpIn = await WarpInFactory.deploy(ROUTER, FACTORY, WMOVR);

    await WarpIn.deployed();

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
  });

  it("Warp-in from $MOVR to WMOVR-FRAX LP", async () => {
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

    await WarpIn.warpIn(
      ethers.constants.AddressZero,
      PAIR_ADDRESS,
      amountToInvest,
      minLP,
      MOVR_FRAX_PATH,
      [],
      { value: amountToInvest }
    );

    console.log(
      `Signer LP Balance after tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );
  });

  it("Warp-in from $FRAX to WMOVR-FRAX LP", async () => {
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
      .swapExactETHForTokens(1, [WMOVR, FRAX], signer.address, deadline, {
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

    // Approve the WarpIn contract to spend the users' $FRAX
    await FraxToken.connect(signer).approve(WarpIn.address, fraxBalance);

    await WarpIn.warpIn(
      FRAX,
      PAIR_ADDRESS,
      fraxBalance,
      minLP,
      [],
      [FRAX, WMOVR]
    );

    console.log(
      `Signer LP Balance after tx ${(
        await LP_PAIR.balanceOf(signer.address)
      ).toString()}`
    );
    fraxBalance = await FraxToken.balanceOf(signer.address);
    console.log(
      "Signer's $FRAX Balance after Warp-in: ",
      fraxBalance.toString()
    );
  });

  it("Warp-in from $MOVR to BNB-BUSD LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(BNB, BUSD);
    const LP_PAIR = makePair(PAIR_ADDRESS);
    // $MOVR amount to invest.
    const movrToInvest = ethers.BigNumber.from(ethers.utils.parseEther("20"));
    const paths = {
      [BNB]: [WMOVR, BNB],
      [BUSD]: [WMOVR, BNB, BUSD],
    };
    const amountsOut = {};
    amountsOut[BNB] = await getAmountsOut(
      router,
      movrToInvest.div(2),
      paths[BNB]
    );
    amountsOut[BUSD] = await getAmountsOut(
      router,
      movrToInvest.div(2),
      paths[BUSD]
    );

    console.log("BNB Amount", amountsOut[BNB].toString());
    console.log("BUSD Amount", amountsOut[BUSD].toString());
    const tokens = sortTokens(BNB, BUSD);
    const minLP = await calculateMinimumLP(
      LP_PAIR,
      amountsOut[tokens[0]],
      amountsOut[tokens[1]],
      5
    );

    let lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("LP Balance before warp-in", lpBalance.toString());
    await WarpIn.warpIn(
      ethers.constants.AddressZero,
      PAIR_ADDRESS,
      movrToInvest,
      minLP,
      paths[tokens[0]],
      paths[tokens[1]],
      { value: movrToInvest }
    );

    lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("LP Balance after the warp", lpBalance.toString());
  });

  it("Warp-in from $MATIC to WMOVR-FRAX LP", async () => {
    const signer = signers[0];
    const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
    const LP_PAIR = makePair(PAIR_ADDRESS);

    const movrToInvest = ethers.BigNumber.from(
      ethers.utils.parseEther("0.002")
    );

    await router
      .connect(signer)
      .swapExactETHForTokens(1, [WMOVR, MATIC], signer.address, deadline, {
        value: movrToInvest,
      });

    const Matic = makeToken(MATIC);

    let maticBalance = await Matic.balanceOf(signer.address);

    const paths = {
      [WMOVR]: [MATIC, WMOVR],
      [FRAX]: [MATIC, WMOVR, FRAX],
    };
    const amountsOut = {};

    amountsOut[WMOVR] = await getAmountsOut(
      router,
      maticBalance.div(2),
      paths[WMOVR]
    );

    amountsOut[FRAX] = await getAmountsOut(
      router,
      maticBalance.div(2),
      paths[FRAX]
    );
    const tokens = sortTokens(WMOVR, FRAX);

    const minLP = await calculateMinimumLP(
      LP_PAIR,
      amountsOut[tokens[0]],
      amountsOut[tokens[1]],
      5
    );

    let lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log("MATIC balance before warp:", maticBalance.toString());
    console.log(`LP Balance before warp: ${lpBalance.toString()}`);
    await Matic.connect(signer).approve(WarpIn.address, maticBalance);

    await WarpIn.warpIn(
      MATIC,
      PAIR_ADDRESS,
      maticBalance,
      minLP,
      paths[FRAX],
      paths[WMOVR]
    );
    lpBalance = await LP_PAIR.balanceOf(signer.address);
    console.log(`LP Balance after warp: ${lpBalance.toString()}`);

    maticBalance = await Matic.balanceOf(signer.address);
    console.log(`MATIC Balance after warp: ${maticBalance.toString()}`);
  });
});
