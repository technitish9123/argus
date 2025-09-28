const hre = require("hardhat");

async function main() {
  const SimpleReceiver = await hre.ethers.getContractFactory("SimpleReceiver");
  const receiver = await SimpleReceiver.deploy();
  await receiver.deployed();
  console.log("SimpleReceiver deployed to:", receiver.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
