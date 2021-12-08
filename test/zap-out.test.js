const { expect } = require("chai");
const { ethers } = require("hardhat");

const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const { ROUTER, FACTORY, WMOVR, FRAX } = require("./lib/constants");
const {
  getAmountsOut,
  calculateMinimumLP,
  makePair,
  bnDiv1e18,
  makeToken,
} = require("./lib/utils");

describe("ZapOutV1 Tests", function () {
  let ZapOut;
  let router;
  let factory;
  let signers;
  beforeEach(async function () {
    console.log("");
    console.log("---------------------------------");

    signers = await ethers.getSigners();

    // Deploy ZapOut contract.
    const ZapOutFactory = await ethers.getContractFactory("ZapOutV1");
    ZapOut = await ZapOutFactory.deploy(ROUTER, WMOVR);
    await ZapOut.deployed();

    // Deploy ZapIn contract; To add liquidity easily for testing zapping-out.
    const ZapInFactory = await ethers.getContractFactory("ZapInV1");
    ZapIn = await ZapInFactory.deploy(ROUTER, FACTORY, WMOVR);
    await ZapIn.deployed();

    // SolarBeam DEX contracts
    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    console.log("---- CONTRACT SETUP COMPLETE ----");
  });

  describe("Zap out from WMOVR<>FRAX", function () {
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

      await ZapIn.zapIn(
        ethers.constants.AddressZero,
        PAIR_ADDRESS,
        movrToLP,
        minLP,
        { value: movrToLP }
      );

      LPBought = (await LP_PAIR.balanceOf(signer.address)).sub(lpBalance);
      console.log("---- LP ADDED ----");
    });

    it("WMOVR<>FRAX -> MOVR", async () => {
      const LPtoRemove = LPBought;

      // Approve ZapOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(ZapOut.address, LPtoRemove);

      // zapOut function sig: zapOut(address fromLP, address to, uint256 lpAmount, address[] memory path0, address[] memory path1)
      await ZapOut.zapOut(
        PAIR_ADDRESS, // address of the liquidity pool of FRAX & WMOVR
        ethers.constants.AddressZero, // address(0) represents $MOVR
        LPtoRemove, // amount of LP tokens to remove
        [FRAX, WMOVR], // most effecient path of swapping FRAX -> WMOVR(which will be converted to MOVR)
        [] // As token1 is $WMOVR, no path is required. It is converted to $MOVR using WETH
      );
    });
    it("WMOVR<>FRAX -> WMOVR", async () => {
      const LPtoRemove = LPBought;

      // Approve ZapOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(ZapOut.address, LPtoRemove);

      // zapOut function sig: zapOut(address fromLP, address to, uint256 lpAmount, address[] memory path0, address[] memory path1)
      await ZapOut.zapOut(
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

      // Approve ZapOut contract to control the signer's LP tokens.
      await LP_PAIR.connect(signer).approve(ZapOut.address, LPtoRemove);

      // zapOut function sig: zapOut(address fromLP, address to, uint256 lpAmount, address[] memory path0, address[] memory path1)
      await ZapOut.zapOut(
        PAIR_ADDRESS, // address of the liquidity pool of FRAX & WMOVR
        FRAX, // address(0) represents $MOVR
        LPtoRemove, // amount of LP tokens to remove
        [], // most effecient path of swapping FRAX -> WMOVR(which will be converted to MOVR)
        [WMOVR, FRAX] // As token1 is $WMOVR, no path is required.
      );

      FraxToken = makeToken(FRAX);
      fraxBalance = await FraxToken.balanceOf(signer.address);
      console.log("FRAX Balance:", fraxBalance.toString());
    });
  });
});
