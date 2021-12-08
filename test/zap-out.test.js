const { expect } = require("chai");
const { ethers } = require("hardhat");

const SolarRouter = require("../artifacts/contracts/interface/solarbeam/ISolarRouter02.sol/ISolarRouter02.json");
const SolarFactory = require("../artifacts/contracts/interface/solarbeam/ISolarFactory.sol/ISolarFactory.json");
const { ROUTER, FACTORY, WMOVR } = require("./lib/constants");

describe("ZapOutV1 Test", function () {
  let ZapOut;
  let router;
  let factory;
  let signers;
  beforeEach(async function () {
    signers = await ethers.getSigners();

    const ZapOutFactory = await ethers.getContractFactory("ZapOutV1");
    ZapOut = await ZapOutFactory.deploy(ROUTER, WMOVR);

    await ZapOut.deployed();

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
  });
});
