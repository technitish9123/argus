/**
 * PYUSD Subscription Agent (demo)
 * - Simulates a recurring PYUSD transfer to a recipient using the SDK execFromFile
 * - Usage (simulate): SIMULATE=1 pnpm -w exec tsx agents/pyusd_subscription.ts
 */

import { JsonRpcProvider, Wallet, Contract, formatUnits, parseUnits } from "ethers";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFromFile } from "@apdsl/agent-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fp = (p: string) => pathToFileURL(p).href;

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PK = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SIMULATE = (process.env.SIMULATE === "1" || String(process.env.SIMULATE).toLowerCase() === "true");

// Config: use environment vars or defaults
const PYUSD_CONTRACT = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const RECIPIENT = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"; // demo
// Amount configuration: prefer raw wei units if provided, otherwise use human amount and token decimals
const PYUSD_AMOUNT_HUMAN = process.env.PYUSD_AMOUNT || '1';
const AMOUNT_WEI_OVERRIDE = process.env.PYUSD_AMOUNT_WEI ? BigInt(process.env.PYUSD_AMOUNT_WEI) : undefined;
const LOOPS = Number(process.env.LOOPS || 1);

// Swap config (in-agent swap fallback)
const ROUTER = process.env.ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const WETH = process.env.WETH || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const SWAP_AMOUNT_ETH = process.env.SWAP_AMOUNT_ETH || '0.01'; // default to 0.01 ETH per top-up
const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || 200); // 2% default

const transferSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/transfer.json"));

const log = (...a: any[]) => console.log("[agent][pyusd]", ...a);

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PK, provider);
  const me = signer.address;

  log("PYUSD subscription demo — starting", { me, PYUSD_CONTRACT, RECIPIENT });

  try {
    const bal = await provider.getBalance(me);
    log(`ETH balance = ${formatUnits(bal, 18)} ETH`);
  } catch (e) {
    log("balance check error", String(e));
  }

  for (let i = 0; i < LOOPS; i++) {
    log(`== subscription tick ${i + 1}/${LOOPS} ==`);
    try {
      // Ensure we have enough PYUSD; determine token decimals and required amount
      // If PYUSD_AMOUNT_WEI was provided, use that directly for compatibility
      const erc20Abi = [
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)'
      ];
      const token = new Contract(PYUSD_CONTRACT, erc20Abi, provider);
      let tokenBal = BigInt((await token.balanceOf(me)).toString());
      // compute required amount in token units
      let requiredAmount: bigint;
      if (AMOUNT_WEI_OVERRIDE) {
        requiredAmount = AMOUNT_WEI_OVERRIDE;
      } else {
        // try to read decimals
        try {
          const decAbi = ['function decimals() view returns (uint8)'];
          const decToken = new Contract(PYUSD_CONTRACT, decAbi, provider);
          const decimals = Number(await decToken.decimals());
          requiredAmount = BigInt(parseUnits(PYUSD_AMOUNT_HUMAN, decimals).toString());
        } catch (e) {
          // fallback to 18 decimals
          requiredAmount = BigInt(parseUnits(PYUSD_AMOUNT_HUMAN, 18).toString());
        }
      }
      try {
        const sym = await token.symbol();
        log(`token ${sym} balance = ${tokenBal}`);
      } catch (e) {
        // ignore symbol failure
      }

      if (tokenBal < requiredAmount) {
        log('Insufficient PYUSD balance, attempting in-agent swap ETH -> PYUSD');
        if (!SIMULATE) {
          try {
            const routerAbi = [
              'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
              'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)'
            ];
            const router = new Contract(ROUTER, routerAbi, signer);
            const pathArr = [WETH, PYUSD_CONTRACT];
            const amountInWei = BigInt(Math.floor(Number(SWAP_AMOUNT_ETH) * 1e18));

            // Try to get expected amounts out
            let minOut = 0n;
            try {
              const amounts = await router.getAmountsOut(amountInWei, pathArr);
              const out = BigInt(amounts[amounts.length - 1].toString());
              const slippageFactor = BigInt(10000 - SLIPPAGE_BPS);
              minOut = (out * slippageFactor) / 10000n;
              log(`router estimated out=${out} minOut(with ${SLIPPAGE_BPS}bps)=${minOut}`);
            } catch (e) {
              log('getAmountsOut failed, proceeding with minOut=0', String(e));
              minOut = 0n;
            }

            const deadline = Math.floor(Date.now() / 1000) + 1200;
            const tx = await router.swapExactETHForTokens(minOut, pathArr, me, deadline, { value: amountInWei, gasLimit: 1_000_000 });
            log('swap tx sent:', tx.hash);
            const rcpt = await tx.wait();
            log('swap rcpt status=', rcpt.status, rcpt.transactionHash);
          } catch (e: any) {
            log('in-agent swap failed:', e && e.message ? e.message : String(e));
          }
        } else {
          log('SIMULATE=true; skipping actual swap');
        }

        // re-check balance after attempting swap
        try {
          tokenBal = BigInt((await token.balanceOf(me)).toString());
          log('post-swap token balance =', tokenBal.toString());
        } catch (e) {
          log('balance re-check failed', String(e));
        }
      }

      if (tokenBal < requiredAmount) {
        log('still insufficient PYUSD after swap attempt; aborting this tick');
        continue;
      }

      const res = await execFromFile(transferSchema, {
        contract: PYUSD_CONTRACT,
        to: RECIPIENT,
        amount: requiredAmount.toString()
      }, RPC_URL, PK, SIMULATE);
      log("exec result:", res?.simulated_amountOut ?? res?.txHash ?? res);
    } catch (e) {
      log("execFromFile error:", String(e));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
