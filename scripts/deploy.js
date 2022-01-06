// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const ROUTER = "0xAA30eF758139ae4a7f798112902Bf6d65612045f";
const FACTORY = "0x049581aEB6Fe262727f290165C29BDAB065a1B68";
const HELPER = "0x37f9a9436f5db1ac9e346eaab482f138da0d8749";
const WMOVR = "0x98878b06940ae243284ca214f92bb71a2b032b8a";
const ROME = "0x4a436073552044D5f2f49B176853ad3Ad473d9d6";
const sROME = "0x89f52002e544585b42f8c7cf557609ca4c8ce12a";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run("compile");

  const WarpInFactory = await hre.ethers.getContractFactory("WarpInV1");

  const WarpIn = await WarpInFactory.deploy(
    ROUTER,
    FACTORY,
    HELPER,
    WMOVR,
    ROME,
    sROME
  );
  await WarpIn.deployed();
  console.log("WarpIn deployed to:", WarpIn.address);

  // const WarpOutFactory = await hre.ethers.getContractFactory("WarpOutV1");

  // const WarpOut = await WarpOutFactory.deploy(ROUTER, WMOVR);
  // await WarpOut.deployed();
  // console.log("WarpInOut deployed to:", WarpOut.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
