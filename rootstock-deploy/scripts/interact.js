const hre = require("hardhat");

async function main() {
  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];

  const deployedAddress = process.env.DEPLOYED_ADDRESS;
  if (!deployedAddress) throw new Error("Set DEPLOYED_ADDRESS in env to the deployed contract address");

  const SimpleReceiver = await hre.ethers.getContractFactory("SimpleReceiver");
  const receiver = SimpleReceiver.attach(deployedAddress);

  console.log("Using deployer:", deployer.address);

  // 1) call ping with a small value
  const tx1 = await receiver.connect(deployer).ping("hello from test", { value: hre.ethers.utils.parseEther("0.001") });
  console.log("Sent ping tx hash:", tx1.hash);
  await tx1.wait();
  console.log("Ping confirmed");

  // 2) send native transfer
  const tx2 = await deployer.sendTransaction({ to: deployedAddress, value: hre.ethers.utils.parseEther("0.002") });
  console.log("Sent transfer tx hash:", tx2.hash);
  await tx2.wait();
  console.log("Transfer confirmed");

  const bal = await receiver.getBalance();
  console.log("Contract balance (wei):", bal.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
