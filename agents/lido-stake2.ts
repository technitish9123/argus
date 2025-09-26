// examples/lido-stake-llm.ts
import { JsonRpcProvider, Wallet, Interface } from "ethers";
import { executeIntentWithSignature } from "../src/intent/execute.js";
import { MainnetRegistry } from "./registry.js";
import OllamaPlanner from "./ollamaLLM.js";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0xYOUR_KEY";

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  // Helper for ERC20 balanceOf
  const erc20 = new Interface([
    "function balanceOf(address) view returns (uint256)",
  ]);

  const getBalanceWei = async (tokenAddr: `0x${string}`) => {
    const a = tokenAddr.toLowerCase();
    if (a === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      return await provider.getBalance(wallet.address);
    }
    const data = erc20.encodeFunctionData("balanceOf", [wallet.address]);
    const ret = await provider.call({ to: tokenAddr, data });
    return erc20.decodeFunctionResult("balanceOf", ret)[0] as bigint;
  };

  // Planner that maps natural language → DSL steps
  const llmClient = new OllamaPlanner({ chainIdDefault: 1, temperature: 0.2 });

  // Ask the planner for 3-step flow
  const steps = await executeIntentWithSignature(
    "Stake 0.01 ETH in Lido → wrap all stETH → supply all wstETH on Aave as collateral",
    {
      chainIdDefault: 1,
      autoInsertApprovals: true,
      registry: MainnetRegistry,
      getBalanceWei,
      llmClient,
      debug: true,
      caller: wallet.address,
    }
  );

  // Execute each tx step sequentially
  for (const [i, s] of steps.entries()) {
    const tx = (s as any).tx; // built tx object { to, data, value, ... }
    console.log(`→ sending [${i}] ${tx.function} to ${tx.to}`);
    const resp = await wallet.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    console.log(`   hash: ${resp.hash}`);
    const rec = await resp.wait();
    console.log(
      `   mined: block=${rec?.blockNumber} status=${rec?.status}`
    );
  }

  console.log("✅ 3-step Lido → wstETH → Aave flow complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
