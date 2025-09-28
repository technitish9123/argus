Verifying AgentExecutor on Rootstock Testnet

1) After deployment note the contract address (e.g. 0xEb00...)

2) The explorer at https://explorer.testnet.rootstock.io supports source verification.

3) You can verify manually by submitting the flattened source and constructor args, or use a verification tool.

4) Minimal steps:
   - Flatten `contracts/AgentExecutor.sol` or copy its contents.
   - On the explorer, choose "Verify Contract" for the deployed address and paste the source, compiler version (0.8.20 or 0.8.21), and ABI-encoded constructor args (none for AgentExecutor).

Agent run instructions

1) Ensure `rootstock-deploy/deployed_agent_executor.json` exists (created by `deploy_and_prepare_agent.js`).
2) Create `.env` in repo root or set env vars:

```
ROOTSTOCK_RPC=https://rpc.testnet.rootstock.io/...
PRIVATE_KEY=0x...
```

3) Run the agent example to deposit + runStrategy:

```bash
node agents/agent_rootstock_example.js
```
