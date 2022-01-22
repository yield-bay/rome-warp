const { expect, assert } = require("chai");
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
  STAKING,
  WMOVR,
  ROME,
  sROME,
  FRAX,
} = require("./lib/constants");

const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const IsROME = require("../artifacts/contracts/interface/romedao/IsROME.sol/IsROME.json");
const IROME = require("../artifacts/contracts/interface/romedao/IROME.sol/IROME.json");

const deadline = "1922966168";

// describe("RomeWarpV1 Test", function () {

describe("WarpIn", () => {
  let RomeWarp;
  let router;
  let factory;
  let srome;
  let rome;
  let signers;
  let prov;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    prov = ethers.getDefaultProvider();

    const RomeWarpFactory = await ethers.getContractFactory("RomeWarpV1");
    RomeWarp = await RomeWarpFactory.deploy(
      ROUTER,
      STAKING,
      WMOVR,
      ROME,
      sROME,
    );

    await RomeWarp.deployed();

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    srome = new ethers.Contract(sROME, IsROME.abi, ethers.provider);
    rome = new ethers.Contract(ROME, IROME.abi, ethers.provider);
  });
  it("should WarpIn to sROME using MOVR", async () => {
    const signer = signers[0];

    const amountToInvest = ethers.BigNumber.from(ethers.utils.parseEther("2"));

    console.log(
      `sROME Balance before warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );

    await RomeWarp.connect(signer).warpIn(
      ethers.constants.AddressZero,
      amountToInvest,
      1,
      [WMOVR, ROME],
      { value: amountToInvest },
    );

    console.log(
      `sROME Balance after warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );
  });

  it("should WarpIn to sROME using FRAX", async () => {
    const signer = signers[0];

    const movrToInvest = ethers.BigNumber.from(ethers.utils.parseEther("2"));

    await router
      .connect(signer)
      .swapExactETHForTokens(1, [WMOVR, FRAX], signer.address, deadline, {
        value: movrToInvest,
      });

    const Frax = makeToken(FRAX);

    let fraxBalance = await Frax.balanceOf(signer.address);
    await Frax.connect(signer).approve(RomeWarp.address, fraxBalance);

    console.log(
      `sROME Balance before warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );

    await RomeWarp.connect(signer).warpIn(FRAX, fraxBalance, 1, [FRAX, ROME], {
      value: fraxBalance,
    });

    fraxBalance = await Frax.balanceOf(signer.address);

    console.log(
      `sROME Balance after warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );
  });
});

describe("WarpOut", () => {
  let RomeWarp;
  let router;
  let factory;
  let srome;
  let rome;
  let signers;
  let prov;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    prov = ethers.getDefaultProvider();

    const RomeWarpFactory = await ethers.getContractFactory("RomeWarpV1");
    RomeWarp = await RomeWarpFactory.deploy(
      ROUTER,
      STAKING,
      WMOVR,
      ROME,
      sROME,
    );

    await RomeWarp.deployed();

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    srome = new ethers.Contract(sROME, IsROME.abi, ethers.provider);
    rome = new ethers.Contract(ROME, IROME.abi, ethers.provider);
  });

  it("should WarpOut from sROME to MOVR", async () => {
    const signer = signers[0];

    const amountToInvest = ethers.BigNumber.from(ethers.utils.parseEther("2"));

    await RomeWarp.connect(signer).warpIn(
      ethers.constants.AddressZero,
      amountToInvest,
      1,
      [WMOVR, ROME],
      { value: amountToInvest },
    );

    console.log(
      `sROME Balance before warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );
    const sROMEBalance = await srome.balanceOf(signer.address);
    const sROMEAmount = sROMEBalance.div(4);
    console.log("sROMEAmount", sROMEAmount);

    await srome.connect(signer).approve(RomeWarp.address, sROMEAmount);

    await RomeWarp.connect(signer).warpOut(
      sROMEAmount,
      ethers.constants.AddressZero,
      1,
      [ROME, WMOVR],
    );
    console.log(
      `sROME Balance after warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );
    assert(
      sROMEBalance - (await srome.balanceOf(signer.address)) ===
        parseInt(sROMEAmount._hex, 16),
      "difference doesn't match",
    );
  });

  it("should WarpOut from sROME to FRAX", async () => {
    const signer = signers[0];

    const amountToInvest = ethers.BigNumber.from(ethers.utils.parseEther("2"));

    await RomeWarp.connect(signer).warpIn(
      ethers.constants.AddressZero,
      amountToInvest,
      1,
      [WMOVR, ROME],
      { value: amountToInvest },
    );

    console.log(
      `sROME Balance before warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );
    const sROMEBalance = await srome.balanceOf(signer.address);
    const sROMEAmount = sROMEBalance.div(4);
    console.log("sROMEAmount", sROMEAmount);

    await srome.connect(signer).approve(RomeWarp.address, sROMEAmount);

    await RomeWarp.connect(signer).warpOut(sROMEAmount, FRAX, 1, [ROME, FRAX]);
    console.log(
      `sROME Balance after warp: ${(
        await srome.balanceOf(signer.address)
      ).toString()}`,
    );

    assert(
      sROMEBalance - (await srome.balanceOf(signer.address)) ===
        parseInt(sROMEAmount._hex, 16),
      "difference doesn't match",
    );
  });
});
