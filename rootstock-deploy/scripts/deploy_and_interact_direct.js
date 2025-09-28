const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ethers = require('ethers');

async function compileContract() {
  const filePath = path.join(__dirname, '../contracts/AgentExecutor.sol');
  const source = fs.readFileSync(filePath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'AgentExecutor.sol': { content: source }
    },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const e of output.errors) {
      console.error(e.formattedMessage || e.message);
    }
    const fatal = output.errors.some((e) => e.severity === 'error');
    if (fatal) throw new Error('Compilation failed');
  }

  const contractOutput = output.contracts['AgentExecutor.sol']['AgentExecutor'];
  return { abi: contractOutput.abi, bytecode: contractOutput.evm.bytecode.object };
}

async function main() {
  const RPC = process.env.ROOTSTOCK_RPC;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) {
    throw new Error('Set ROOTSTOCK_RPC and PRIVATE_KEY in environment');
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  console.log('Using deployer:', wallet.address);

  const { abi, bytecode } = await compileContract();

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  console.log('Deploy tx hash:', contract.deployTransaction.hash);
  await contract.deployed();
  console.log('Deployed at:', contract.address);

  // Tx1: deposit 0.001 RBTC
  const tx1 = await contract.deposit({ value: ethers.utils.parseEther('0.001') });
  console.log('Deposit tx hash:', tx1.hash);
  await tx1.wait();
  console.log('Deposit confirmed');

  // Tx2: borrow (mock)
  const tx2 = await contract.borrow(ethers.utils.parseUnits('100', 18));
  console.log('Borrow tx hash:', tx2.hash);
  await tx2.wait();
  console.log('Borrow confirmed');

  const actionCount = await contract.getActionCount();
  console.log('Action count:', actionCount.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
