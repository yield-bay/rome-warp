// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const ROUTER = "0xAA30eF758139ae4a7f798112902Bf6d65612045f";
const STAKING = "0x6f7d019502e17f1ef24ac67a260c65dd23b759f1";
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

  const RomeWarpFactory = await hre.ethers.getContractFactory("RomeWarpV1");

  const RomeWarp = await RomeWarpFactory.deploy(
    ROUTER,
    STAKING,
    WMOVR,
    ROME,
    sROME,
  );
  await RomeWarp.deployed();
  console.log("RomeWarp deployed to:", RomeWarp.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
