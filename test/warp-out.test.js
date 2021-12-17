const { expect } = require("chai");
const { ethers } = require("hardhat");

const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const { ROUTER, FACTORY, WMOVR, FRAX, BNB, BUSD } = require("./lib/constants");
const {
  getAmountsOut,
  calculateMinimumLP,
  makePair,
  bnDiv1e18,
  makeToken,
  sortTokens,
} = require("./lib/utils");

describe("WarpOutV1 Tests", function () {
  let WarpOut;
  let router;
  let factory;
  let signers;
  beforeEach(async function () {
    console.log("");
    console.log("---------------------------------");

    signers = await ethers.getSigners();

    // Deploy WarpOut contract.
    const WarpOutFactory = await ethers.getContractFactory("WarpOutV1");
    WarpOut = await WarpOutFactory.deploy(ROUTER, WMOVR);
    await WarpOut.deployed();

    // Deploy WarpIn contract; To add liquidity easily for testing warpping-out.
    const WarpInFactory = await ethers.getContractFactory("WarpInV1");
    WarpIn = await WarpInFactory.deploy(ROUTER, FACTORY, WMOVR);
    await WarpIn.deployed();

    // SolarBeam DEX contracts
    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    console.log("---- CONTRACT SETUP COMPLETE ----");
  });

  describe("Warp-out from WMOVR<>FRAX", function () {
    let signer;
    let PAIR_ADDRESS;
    let LP_PAIR;
    let movrToLP;
    let LPBought;
    beforeEach(async function () {
      // ADD 10 $MOVR WORTH LIQUIDITY TO POOL

      signer = signers[0];
      PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
      LP_PAIR = makePair(PAIR_ADDRESS);
      movrToLP = ethers.BigNumber.from(ethers.utils.parseEther("10"));

      const amount0 = await getAmountsOut(router, movrToLP.div(2), [
        WMOVR,
        FRAX,
      ]);
      const amount1 = movrToLP.div(2);
      const minLP = await calculateMinimumLP(LP_PAIR, amount0, amount1, 1);

      let lpBalance = await LP_PAIR.balanceOf(signer.address);

      await WarpIn.warpIn(
        ethers.constants.AddressZero,
        PAIR_ADDRESS,
        movrToLP,
        minLP,
        [WMOVR, FRAX],
        [],
        { value: movrToLP }
      );

      LPBought = (await LP_PAIR.balanceOf(signer.address)).sub(lpBalance);
      console.log("------------ LP ADDED -----------");
      console.log("---------------------------------");
    });

    it("WMOVR<>FRAX -> MOVR", async () => {
      const LPtoRemove = LPBought;

      // Approve WarpOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      await WarpOut.warpOut(
        PAIR_ADDRESS, // address of the liquidity pool of FRAX & WMOVR
        ethers.constants.AddressZero, // address(0) represents $MOVR
        LPtoRemove, // amount of LP tokens to remove
        [FRAX, WMOVR], // most effecient path of swapping FRAX -> WMOVR(which will be converted to MOVR)
        [] // As token1 is $WMOVR, no path is required. It is converted to $MOVR using WETH
      );
    });
    it("WMOVR<>FRAX -> WMOVR", async () => {
      const LPtoRemove = LPBought;

      // Approve WarpOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      await WarpOut.warpOut(
        PAIR_ADDRESS, // address of the liquidity pool of FRAX & WMOVR
        WMOVR, // address(0) represents $MOVR
        LPtoRemove, // amount of LP tokens to remove
        [FRAX, WMOVR], // most effecient path of swapping FRAX -> WMOVR(which will be converted to MOVR)
        [] // As token1 is $WMOVR, no path is required.
      );

      WmovrToken = makeToken(WMOVR);
      wmovrBalance = await WmovrToken.balanceOf(signer.address);
      console.log("WMOVR Balance:", wmovrBalance.toString());
    });

    it("WMOVR<>FRAX -> FRAX", async () => {
      const LPtoRemove = LPBought;

      // Approve WarpOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      await WarpOut.warpOut(
        PAIR_ADDRESS, // address of the liquidity pool of FRAX & WMOVR
        FRAX,
        LPtoRemove, // amount of LP tokens to remove
        [],
        [WMOVR, FRAX]
      );

      FraxToken = makeToken(FRAX);
      fraxBalance = await FraxToken.balanceOf(signer.address);
      console.log("FRAX Balance:", fraxBalance.toString());
    });
  });

  describe("Warp-out from BNB<>BUSD", function () {
    let signer;
    let PAIR_ADDRESS;
    let LP_PAIR;
    let movrToLP;
    let LPBought;

    let paths;
    const tokens = sortTokens(BNB, BUSD);

    beforeEach(async function () {
      // ADD 10 $MOVR WORTH LIQUIDITY TO POOL
      paths = {
        [BNB]: {
          [WMOVR]: [WMOVR, BNB],
          [BUSD]: [BUSD, BNB],
          [BNB]: [],
        },
        [BUSD]: {
          [WMOVR]: [WMOVR, BNB, BUSD],
          [BNB]: [BNB, BUSD],
          [BUSD]: [],
        },
      };

      signer = signers[0];
      PAIR_ADDRESS = await factory.getPair(BNB, BUSD);

      LP_PAIR = makePair(PAIR_ADDRESS);
      movrToLP = ethers.BigNumber.from(ethers.utils.parseEther("1"));

      const amountsOut = {};
      amountsOut[BNB] = await getAmountsOut(
        router,
        movrToLP.div(2),
        paths[BNB][WMOVR]
      );
      amountsOut[BUSD] = await getAmountsOut(
        router,
        movrToLP.div(2),
        paths[BUSD][WMOVR]
      );

      const minLP = await calculateMinimumLP(
        LP_PAIR,
        amountsOut[tokens[0]],
        amountsOut[tokens[1]],
        5
      );

      let lpBalance = await LP_PAIR.balanceOf(signer.address);

      await WarpIn.warpIn(
        ethers.constants.AddressZero,
        PAIR_ADDRESS,
        movrToLP,
        minLP,
        paths[tokens[0]][WMOVR],
        paths[tokens[1]][WMOVR],
        { value: movrToLP }
      );

      LPBought = (await LP_PAIR.balanceOf(signer.address)).sub(lpBalance);

      console.log("----------- LP ADDED ------------");
      console.log("---------------------------------");
    });

    it("BNB<>BUSD -> MOVR", async () => {
      const LPtoRemove = LPBought;

      // Approve WarpOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      await WarpOut.warpOut(
        PAIR_ADDRESS, // address of the liquidity pool of BNB & BUSD
        ethers.constants.AddressZero, // address(0) represents $MOVR
        LPtoRemove, // amount of LP tokens to remove
        paths[tokens[0]][WMOVR].reverse(),
        paths[tokens[1]][WMOVR].reverse()
      );
    });

    it("BNB<>BUSD -> BNB", async () => {
      const BNBToken = makeToken(BNB);
      const LPtoRemove = LPBought;

      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      console.log(
        "BNB balance before warp-out:",
        (await BNBToken.balanceOf(signer.address)).toString()
      );

      await WarpOut.warpOut(
        PAIR_ADDRESS,
        BNB,
        LPtoRemove,
        paths[BNB][BNB],
        paths[BNB][BUSD]
      );
      console.log(
        "BNB balance after warp-out:",
        (await BNBToken.balanceOf(signer.address)).toString()
      );
    });

    it("BNB<>BUSD -> BUSD", async () => {
      const LPtoRemove = LPBought;
      const BUSDToken = makeToken(BUSD);

      await LP_PAIR.connect(signer).approve(WarpOut.address, LPtoRemove);

      console.log(
        "BUSD balance before warp-out:",
        (await BUSDToken.balanceOf(signer.address)).toString()
      );

      await WarpOut.warpOut(
        PAIR_ADDRESS,
        BUSD,
        LPtoRemove,
        paths[BUSD][BNB],
        paths[BUSD][BUSD]
      );

      console.log(
        "BUSD balance before warp-out:",
        (await BUSDToken.balanceOf(signer.address)).toString()
      );
    });
  });
});
