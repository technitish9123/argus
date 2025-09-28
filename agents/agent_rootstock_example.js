const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
require('dotenv').config();

async function main() {
  const RPC = process.env.ROOTSTOCK_RPC;
  const PK = process.env.PRIVATE_KEY;
  if (!RPC || !PK) throw new Error('Set ROOTSTOCK_RPC and PRIVATE_KEY in .env');

  const artifactPath = path.join(__dirname, '../rootstock-deploy/deployed_agent_executor.json');
  if (!fs.existsSync(artifactPath)) throw new Error('deploy_and_prepare_agent must be run first');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const contract = new ethers.Contract(artifact.address, artifact.abi, wallet);

  console.log('[Agent] Address', wallet.address, '->', artifact.address);

  // deposit a small amount (if balance allows)
  const bal = await provider.getBalance(wallet.address);
  console.log('[Agent] Balance RBTC:', ethers.utils.formatEther(bal));
  const depositAmount = ethers.utils.parseEther('0.0001');
  if (bal.gte(depositAmount)) {
    const d = await contract.deposit({ value: depositAmount });
    console.log('[Agent] deposit tx', d.hash);
    await d.wait();
  } else console.log('[Agent] Insufficient balance to deposit');

  // run a named strategy (DSL name can be included)
  const name = 'example-dsl-strategy-1';
  const s = await contract.runStrategy(name);
  console.log('[Agent] runStrategy tx', s.hash);
  await s.wait();

  console.log('[Agent] Done');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
