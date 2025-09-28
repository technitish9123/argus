/**
 * Flow Track Example Loop
 * - Minimal demo agent that mirrors the structure of `rootstock_loop.ts` but targets
 *   Flow (placeholder). This agent is intentionally lightweight: it demonstrates
 *   how a Flow track script is wired into the RunManager, uses SDK execFromFile
 *   where possible, and emits similar logs/telemetry.
 *
 * Usage (simulate):
 *   pnpm tsx agents/flow_loop.ts
 */

import { JsonRpcProvider, Wallet, Contract, ethers, formatUnits } from "ethers";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFromFile } from "@apdsl/agent-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fp = (p: string) => pathToFileURL(p).href;

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PK = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
if (!PK) throw new Error("Set PRIVATE_KEY");
const SIMULATE = (process.env.SIMULATE === "1" || String(process.env.SIMULATE).toLowerCase() === "true");

// Params
const LOOPS = Number(process.env.LOOPS || 1);
const INITIAL_FUNDS_WEI = BigInt(process.env.INITIAL_FUNDS_WEI || 10_000_000_000_000_000n); // 0.01

// Schemas (placeholders)
const transferSchema = fp(path.join(__dirname, "../sdk/schemas/flow/actions/transfer.json"));
const placeholderSchema = fp(path.join(__dirname, "../sdk/schemas/flow/actions/placeholder.json"));

const log = (...a: any[]) => console.log("[agent][flow]", ...a);

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PK, provider);
  const me = await signer.getAddress();

  log("Flow demo loop — starting", { me });

  // Check balance
  try {
    const bal = await provider.getBalance(me);
    log(`balance = ${formatUnits(bal, 18)} ETH`);
    if (bal < INITIAL_FUNDS_WEI) {
      throw new Error(`Need at least ${formatUnits(INITIAL_FUNDS_WEI, 18)} ETH`);
    }
  } catch (e) {
    log("balance check failed", String(e));
    if (!SIMULATE) throw e;
  }

  // optional: run some placeholder Flow actions via SDK
  if (transferSchema) {
    log("executing placeholder transfer action via SDK (demo)");
    try {
      await execFromFile(transferSchema, {
        // placeholder fields; execFromFile will handle simulate flag
        to: me,
        amount: INITIAL_FUNDS_WEI.toString()
      }, RPC_URL, PK, SIMULATE);
    } catch (e) {
      log("execFromFile failed (expected in demo):", String(e));
    }
  }

  for (let i = 0; i < LOOPS; i++) {
    log(`== loop ${i + 1}/${LOOPS} ==`);
    // placeholder loop work: call placeholder schema or emit logs
    try {
      if (placeholderSchema) {
        await execFromFile(placeholderSchema, { actor: me, tick: i }, RPC_URL, PK, SIMULATE);
      } else {
        log("no placeholder schema — emitting demo log");
      }
    } catch (e) {
      log("placeholder action error:", String(e));
    }
  }

  // Telemetry
  setInterval(async () => {
    try {
      const bal = await provider.getBalance(me);
      log(`tick balance=${formatUnits(bal, 18)} ETH`);
    } catch (e) {
      log("telemetry error", String(e));
    }
  }, 60_000);
}

main().catch((e) => { console.error(e); process.exit(1); });
