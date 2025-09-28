/**
 * PYUSD Subscription Agent (ETH → PYUSD Uniswap v3 Swap)
 * Hackathon demo: auto-top up PYUSD from ETH and pay subscription
 */

import { JsonRpcProvider, Wallet, Contract, formatUnits, parseUnits } from "ethers";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFromFile } from "@apdsl/agent-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fp = (p: string) => pathToFileURL(p).href;

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PK =
  process.env.PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const SIMULATE =
  process.env.SIMULATE === "1" || String(process.env.SIMULATE).toLowerCase() === "true";

// Config
const PYUSD = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const RECIPIENT = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ETH_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // 👈 raw ETH
const V3_FEE = 500;

const TARGET_PYUSD = "0.0001"; // want at least 1 PYUSD
const SWAP_ETH = "0.001"; // top-up amount in ETH

const transferSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/transfer.json"));

const log = (...a: any[]) => console.log("[agent][pyusd-sub]", ...a);

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PK, provider);
  const me = signer.address;

  log("starting subscription demo", { me, PYUSD, RECIPIENT });

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  const token = new Contract(PYUSD, erc20Abi, provider);
  const decimals = Number(await token.decimals());
  const target = parseUnits(TARGET_PYUSD, decimals);

  log("== tick 1/1 ==");

  let bal = BigInt(await token.balanceOf(me));
  log(`balance=${formatUnits(bal, decimals)} PYUSD | need=${TARGET_PYUSD}`);

  if (bal < target) {
    log(`⚠️ insufficient PYUSD — swapping ${SWAP_ETH} ETH → PYUSD`);

    const amountIn = parseUnits(SWAP_ETH, 18).toString();

    const rawInputs = {
      tokenIn: ETH_SENTINEL, // 👈 no WETH
      tokenOut: PYUSD,
      fee: V3_FEE,
      recipient: me,
      deadline: Math.floor(Date.now() / 1000) + 1200,
      amountIn,
      amountOutMinimum: "0",
      sqrtPriceLimitX96: "0"
    };

    try {
      if (!SIMULATE) {
        const routerAbi = [
          "function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns (uint256)"
        ];
        const router = new Contract(UNISWAP_V3_ROUTER, routerAbi, signer);

        const tx = await router.exactInputSingle(rawInputs, {
          value: amountIn, // send ETH
          gasLimit: 1_000_000
        });
        log("swap tx:", tx.hash);
        await tx.wait();
      } else {
        log("SIMULATE=true — skip swap");
      }
    } catch (e: any) {
      log("swap failed:", e?.message || String(e));
    }

    bal = BigInt(await token.balanceOf(me));
    log("post-swap balance=", formatUnits(bal, decimals));
  }

  if (bal >= target) {
    try {
      const res = await execFromFile(
        transferSchema,
        { contract: PYUSD, to: RECIPIENT, amount: target.toString() },
        RPC_URL,
        PK,
        SIMULATE
      );
      log("subscription payment sent:", res?.txHash ?? res);
    } catch (e) {
      log("transfer failed:", String(e));
    }
  } else {
    log("❌ still insufficient PYUSD — skipping");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
