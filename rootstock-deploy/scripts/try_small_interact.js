const ethers = require('ethers');

async function main() {
  const RPC = process.env.ROOTSTOCK_RPC;
  const PK = process.env.PRIVATE_KEY;
  const CONTRACT = process.env.CONTRACT || '0xEb00Fa0dD4089Cc1ae7177ef57dc4e03B64f89a4';
  if (!RPC || !PK) throw new Error('Set ROOTSTOCK_RPC and PRIVATE_KEY in env');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const abi = [
    'function deposit() payable',
    'function borrow(uint256 amount)'
  ];
  const contract = new ethers.Contract(CONTRACT, abi, wallet);

  console.log('Using', wallet.address, '-> contract', CONTRACT);

  // Try small deposit
  const depositValue = ethers.utils.parseEther('0.0001');
  console.log('Sending deposit of', ethers.utils.formatEther(depositValue), 'RBTC');
  const tx1 = await contract.deposit({ value: depositValue });
  console.log('Deposit tx hash:', tx1.hash);
  await tx1.wait();
  console.log('Deposit confirmed');

  // Try borrow (mock)
  const tx2 = await contract.borrow(ethers.utils.parseUnits('1', 18));
  console.log('Borrow tx hash:', tx2.hash);
  await tx2.wait();
  console.log('Borrow confirmed');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
