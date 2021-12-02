const { ethers } = require("ethers");

// Logs current block number to console as a check if the mainnet was forked correctly
async function main() {
  const provider = new ethers.providers.JsonRpcProvider();
  console.log(await provider.getBlockNumber());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
