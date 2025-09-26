// examples/lido-stake.ts
import { executeIntent, makeMockLLM } from "../src/index.js";
import { MainnetRegistry } from "./registry.js";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0xYOUR_KEY";

async function main() {
  // “Stake 0.01 ETH in Lido” → plan with one Lido submit step
  const mockPlan = {
    actions: [
      {
        protocol: "lido",
        action: "stake",
        params: {
          amount: { kind: "ether", value: "0.01" },
          referral: undefined,
        },
      },
    ],
    meta: { chainId: 1 },
  };

  const llm = {
    plan: async (prompt: string) => mockPlan,
  };

  const res = await executeIntent("stake 0.01 ETH in lido", {
    rpcUrl: RPC_URL,
    privateKey: PRIVATE_KEY,
    chainIdDefault: 1,
    autoInsertApprovals: true,
    registry: MainnetRegistry,
    llmClient: llm, // optional; if omitted we use the built-in lido heuristic
    debug: true,
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
