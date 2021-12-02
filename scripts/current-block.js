const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider();
  console.log(
    (
      await provider.getBalance("0xF3616d8Cc52C67E7F0991a0A3C6dB9F5025fA60C")
    ).toString()
  );
  // console.log(ethers);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
