Rootstock Testnet deploy and interact

This small Hardhat project deploys a minimal contract to Rootstock testnet and runs two on-chain transactions (a payable contract call and a native transfer).

Setup

1. Install dependencies:

```bash
cd rootstock-deploy
pnpm install  # or npm install / yarn
```

2. Create a .env file in this folder with the following values:

```
RSK_TESTNET_RPC=https://public-node.testnet.rsk.co
DEPLOYER_PRIVATE_KEY=0x...    # account with testnet funds
```

3. Compile & deploy:

```bash
pnpm run compile
pnpm run deploy
```

The deploy script prints the deployed address. Copy it and export it as DEPLOYED_ADDRESS, then run interact.

4. Interact (this will execute two on-chain txs):

```bash
export DEPLOYED_ADDRESS=0x....
pnpm run interact
```

Notes

- You need testnet RSK funds for the deployer account. Use a testnet faucet if available.
- The interact script waits for confirmations and prints tx hashes.
