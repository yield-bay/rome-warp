const { expect } = require("chai");
const { ethers } = require("hardhat");

// const {
//   calculateMinimumLP,
//   sortTokens,
//   makePair,
//   makeToken,
//   getAmountsOut,
// } = require("./lib/utils.js");

const {
  ROUTER,
  FACTORY,
  HELPER,
  STAKING,
  WMOVR,
  ROME,
  sROME,
} = require("./lib/constants");

// const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
// const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const IsROME = require("../artifacts/contracts/interface/romedao/IsROME.sol/IsROME.json");
const IROME = require("../artifacts/contracts/interface/romedao/IROME.sol/IROME.json");

// const deadline = "1922966168";

describe("WarpInV1 Test", function () {
  let WarpIn;
  // let router;
  // let factory;
  let srome;
  let rome;
  let signers;
  let prov;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    prov = ethers.getDefaultProvider();

    const WarpInFactory = await ethers.getContractFactory("WarpInV1");
    WarpIn = await WarpInFactory.deploy(
      ROUTER,
      FACTORY,
      STAKING,
      HELPER,
      WMOVR,
      ROME,
      sROME
    );

    await WarpIn.deployed();

    // router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    // factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    srome = new ethers.Contract(sROME, IsROME.abi, ethers.provider);
    rome = new ethers.Contract(ROME, IROME.abi, ethers.provider);
  });

  it("Warp-in from $MOVR to sROME", async () => {
    const signer = signers[0];
    // console.log("signer", signer);
    // const PAIR_ADDRESS = await factory.getPair(WMOVR, FRAX);
    // const LP_PAIR = makePair(PAIR_ADDRESS);

    const amountToInvest = ethers.BigNumber.from(ethers.utils.parseEther("2"));

    console.log("Signer address: %s", signer.address);
    console.log(
      `Signer srome Balance before tx ${(
        await srome.balanceOf(signer.address)
      ).toString()}`
    );
    console.log(
      `Signer rome Balance before tx ${(
        await rome.balanceOf(signer.address)
      ).toString()}`
    );
    console.log("provbal", parseInt(await prov.getBalance(signer.address), 16));
    // console.log("signermovrbal", await signer.getBalance(signer.address));

    // const approveTx = await srome
    //   .connect(signer)
    //   .approve("0x6f7d019502e17f1ef24ac67a260c65dd23b759f1", 4);
    // await approveTx.wait();

    // const transferTx = await srome
    //   .connect(signer)
    //   .transfer(signer.address, 1000);
    // await transferTx.wait();

    const tb = await WarpIn.connect(signer).warpIn(
      ethers.constants.AddressZero,
      // PAIR_ADDRESS,
      amountToInvest,
      // minLP,
      [WMOVR, ROME],
      { value: amountToInvest }
    );
    console.log("tb", parseInt(tb.value, 16));

    console.log(
      `Signer srome Balance after tx ${(
        await srome.balanceOf(signer.address)
      ).toString()}`
    );
    console.log(
      `Signer rome Balance after tx ${(
        await rome.balanceOf(signer.address)
      ).toString()}`
    );
    console.log("provbal", parseInt(await prov.getBalance(signer.address), 16));
    // console.log("signermovrbal", await signer.getBalance(signer.address));
  });
});
