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
} = require("./lib/utils");

describe("ZapOutV1 Test", function () {
  let ZapOut;
  let router;
  let factory;
  let signers;
  beforeEach(async function () {
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

    it("1.", async () => {
      console.log(LPBought.toString());
    });
    it("2.", async () => {
      console.log(LPBought.toString());
    });
  });

  // it("ZapOut from WMOVR<>FRAX to MOVR", async () => {
  //   // Add liquidity worth 5 MOVR to WMOVR<>FRAX pool.
  //   const signer = signers[0];
  //   const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
  //   const LP_PAIR = makePair(PAIR_ADDRESS);

  //   const movrToInvest = ethers.BigNumber.from(ethers.utils.parseEther("5"));

  //   const amount0 = await getAmountsOut(router, movrToInvest.div(2), [
  //     WMOVR,
  //     FRAX,
  //   ]);
  //   let movrBalance = await ethers.provider.getBalance(signer.address);
  //   console.log(
  //     "MOVR balance before Zap:",
  //     bnDiv1e18(movrBalance).toString(),
  //     "$MOVR"
  //   );
  //   const amount1 = movrToInvest.div(2);
  //   const minLP = await calculateMinimumLP(LP_PAIR, amount0, amount1, 5);
  //   let LPbalance = await LP_PAIR.balanceOf(signer.address);

  //   // zapIn(address fromToken, address toPool, uint256 amountToZap, uint256 minimumLPBought)

  //   const tx = await ZapIn.zapIn(
  //     ethers.constants.AddressZero,
  //     PAIR_ADDRESS,
  //     movrToInvest,
  //     minLP,
  //     { value: movrToInvest }
  //   );

  //   const LPBought = (await LP_PAIR.balanceOf(signer.address)).sub(LPbalance);
  //   console.log("LP Bought", LPBought.toString());
  //   movrBalance = await ethers.provider.getBalance(signer.address);
  //   console.log(
  //     "MOVR balance after zap-in:",
  //     bnDiv1e18(movrBalance).toString(),
  //     "$MOVR"
  //   );
  //   console.log("--- Zapping out ---");
  //   await LP_PAIR.connect(signer).approve(ZapOut.address, LPBought);
  //   // zapOut(address fromLP, address to, uint256 lpAmount, address[] memory path0, address[] memory path1)
  //   const zapOutTx = await ZapOut.zapOut(
  //     PAIR_ADDRESS,
  //     ethers.constants.AddressZero,
  //     LPBought,
  //     [FRAX, WMOVR],
  //     []
  //   );

  //   movrBalance = await ethers.provider.getBalance(signer.address);
  //   console.log(
  //     "MOVR balance after zap-out:",
  //     bnDiv1e18(movrBalance).toString(),
  //     "$MOVR"
  //   );
  // });
});
