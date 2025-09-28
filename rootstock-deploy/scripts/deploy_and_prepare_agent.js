const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ethers = require('ethers');

async function compileContract() {
  const filePath = path.join(__dirname, '../contracts/AgentExecutor.sol');
  const source = fs.readFileSync(filePath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'AgentExecutor.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const e of output.errors) console.error(e.formattedMessage || e.message);
    const fatal = output.errors.some((e) => e.severity === 'error');
    if (fatal) throw new Error('Compilation failed');
  }
  const contractOutput = output.contracts['AgentExecutor.sol']['AgentExecutor'];
  return { abi: contractOutput.abi, bytecode: contractOutput.evm.bytecode.object };
}

async function main() {
  const RPC = process.env.ROOTSTOCK_RPC;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) throw new Error('Set ROOTSTOCK_RPC and PRIVATE_KEY in env');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  console.log('Deployer:', wallet.address);

  const { abi, bytecode } = await compileContract();
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  console.log('Deploy tx:', contract.deployTransaction.hash);
  await contract.deployed();
  console.log('Deployed at:', contract.address);

  // Save minimal artifact for agents
  const artifact = { address: contract.address, abi };
  fs.writeFileSync(path.join(__dirname, '../deployed_agent_executor.json'), JSON.stringify(artifact, null, 2));
  console.log('Wrote deployed_agent_executor.json');

  console.log('Done. You can now run agents/agent_rootstock_example.js');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
