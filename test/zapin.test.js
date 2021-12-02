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

describe("ZapInV1 Test", function () {
  let ZapIn;
  let router;
  let factory;
  let pairs = {};

  beforeEach(async function () {
    /**
     * What all do I require to zap-in?
     * 1. Address of token to zap from
     * 2. Address of pool to zap to
     * 3. Address of the router, factory, and wmovr
     */
    console.log("This'll run before each test");
    console.log("Deploying ZapIn.sol");
    const ZapInFactory = await ethers.getContractFactory("ZapInV1");
    ZapIn = await ZapInFactory.deploy(ROUTER, FACTORY, WMOVR);

    await ZapIn.deployed();
    console.log(`Deployed to ${ZapIn.address}`);

    router = new ethers.Contract(ROUTER, SolarRouter.abi, ethers.provider);
    factory = new ethers.Contract(FACTORY, SolarFactory.abi, ethers.provider);
    pairs["FRAX_WMOVR"] = await factory.getPair(WMOVR, FRAX);
  });

  it("Fetch WMOVR balance", async () => {
    const wmovr = new ethers.Contract(WMOVR, SolarERC20.abi, ethers.provider);

    console.log(`
      ${ethers.utils.formatUnits(
        await wmovr.balanceOf("0xF3616d8Cc52C67E7F0991a0A3C6dB9F5025fA60C")
      )} WMOVR`);
    console.log(pairs);
  });
});
