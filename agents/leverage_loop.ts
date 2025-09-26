/**
 * Leverage loop example:
 *  - Supply WETH to Aave v3
 *  - Borrow USDC
 *  - Swap USDC -> WETH on Uniswap V3
 *  - Supply the new WETH
 *  - Repeat N loops
 *
 * Run:
 *   export RPC_URL=http://127.0.0.1:8545
 *   export PRIVATE_KEY=0x<anvil-first-account-pk>
 *   # Ensure you hold enough WETH beforehand (on a mainnet fork, wrap some ETH):
 *   # cast send 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 "deposit()" --value 0.5ether --rpc-url $RPC_URL --private-key $PRIVATE_KEY
 *   pnpm tsx examples/leverage_loop.ts
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFromFile } from "@apdsl/agent-kit";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  getAddress,
  formatUnits,
  ethers
} from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** ====== CONFIG ====== */
const CHAIN_ID = 1;
const FEE_TIER = 3000; // Uniswap V3 0.30%
const LOOPS = 1;       // number of leverage loops
// Borrow amount of USDC per loop (adjust for your fork liquidity)
const BORROW_USDC_PER_LOOP = 25_000_000n; // 25 USDC (6dp)
// Initial WETH to supply before looping
const INITIAL_SUPPLY_WETH = 100_000_000_000_000_000n; // 0.1 WETH

// Addresses (Ethereum mainnet)
const POOL = getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"); // Aave v3 Pool
const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const ROUTER = getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564");

// Minimal ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

/** ====== helpers ====== */
function fp(p: string) { return pathToFileURL(p).href; }

// concise agent logger used for user-facing output
function log(...args: any[]) {
  // join simple values for neat single-line output
  const out = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log('[agent]', out);
}

function encodePath(tokenIn: string, fee: number, tokenOut: string): `0x${string}` {
  const a = tokenIn.toLowerCase().replace(/^0x/, "");
  const b = tokenOut.toLowerCase().replace(/^0x/, "");
  const feeHex = fee.toString(16).padStart(6, "0");
  return `0x${a}${feeHex}${b}` as const;
}

async function ensureAllowance(
  approveSchemaUrl: string,
  tokenAddr: string,
  owner: string,
  spender: string,
  need: bigint,
  rpcUrl: string,
  pk: string,
  symbol: string,
  decimals: number,
  erc: Contract
) {
  const cur = await erc.allowance(owner, spender);
  if (cur >= need) return;
  console.log(`→ approving ${symbol} to ${spender} for at least ${formatUnits(need, decimals)} ${symbol}...`);
  const dry = process.env.DEBUG_DRY_RUN === "1";
  const out = await execFromFile(approveSchemaUrl, {
    contract: tokenAddr,
    spender,
    amount: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  }, rpcUrl, pk, dry);
  if (dry) {
    console.log("approve dryRun ->", out);
    // Allow opting-in to actually sending approvals while keeping other
    // operations in dry-run mode. Set AUTO_APPROVE=1 to send approve txs.
    if (process.env.AUTO_APPROVE === "1") {
      console.log("AUTO_APPROVE=1 — sending approve tx for real (despite DEBUG_DRY_RUN)");
      await execFromFile(approveSchemaUrl, {
        contract: tokenAddr,
        spender,
        amount: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      }, rpcUrl, pk, false);
    }
  }
}

/** ====== main ====== */
async function main() {
  // Prefer environment variables so this script can run against different
  // nodes without editing source. For quick local testing with Anvil we
  // fall back to the well-known Anvil first-account key but emit a warning.
  const rpc = process.env.RPC_URL || "http://127.0.0.1:8545";
  const pk = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  if (!process.env.PRIVATE_KEY) {
    console.warn("WARNING: PRIVATE_KEY not set — using Anvil default key for local testing only. Do NOT use this key on mainnet.");
  }
  if (!rpc) throw new Error("Set RPC_URL (e.g. export RPC_URL=http://127.0.0.1:8545)");

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(pk, provider);
  const me = await signer.getAddress();

  const weth = new Contract(WETH, ERC20_ABI, provider);
  const usdc = new Contract(USDC, ERC20_ABI, provider);

  // Helper contract instance connected to our signer so we can call payable
  // deposit() on WETH when running against a local fork (wrap ETH -> WETH).
  const wethWithSigner = new Contract(WETH, [...ERC20_ABI, "function deposit() payable"], signer);

  // Ensure the token contracts actually exist on the RPC we're connected to.
  // A common cause of the `could not decode result data (value="0x")` error is
  // that the node is not a mainnet fork and the mainnet token addresses have no
  // contract code at the given RPC. Check and give a helpful error.
  const [wethCode, usdcCode] = await Promise.all([
    provider.getCode(WETH),
    provider.getCode(USDC)
  ]);
  if (wethCode === "0x") {
    throw new Error(`No contract found at WETH address ${WETH} on RPC ${rpc}. Ensure you're using a mainnet-fork (e.g. anvil --fork-url <MAINNET_RPC>) or a real mainnet RPC URL.`);
  }
  if (usdcCode === "0x") {
    throw new Error(`No contract found at USDC address ${USDC} on RPC ${rpc}. Ensure you're using a mainnet-fork (e.g. anvil --fork-url <MAINNET_RPC>) or a real mainnet RPC URL.`);
  }

  const [wethDec, usdcDec, wethSym, usdcSym] = await Promise.all([
    weth.decimals(), usdc.decimals(), weth.symbol(), usdc.symbol()
  ]);

  // Schema URLs
  const approveSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/approve.json"));
  const aaveSupply = fp(path.join(__dirname, "../sdk//schemas/aave_v3/actions/supply.json"));
  const aaveBorrow = fp(path.join(__dirname, "../sdk//schemas/aave_v3/actions/borrow.json"));
  const uniExactInSgl = fp(path.join(__dirname, "../sdk//schemas/uniswap_v3/actions/exactInputSingle.json"));

  // ====== STEP 0: initial supply WETH ======
  log(`== Initial supply ==`);
  // If we don't hold enough WETH, try to wrap ETH into WETH (useful on forks).
  const curWethBal = await weth.balanceOf(me);
  if (curWethBal < INITIAL_SUPPLY_WETH) {
    const need = INITIAL_SUPPLY_WETH - curWethBal;
  log(`insufficient WETH balance (${formatUnits(curWethBal, wethDec)}), wrapping ${formatUnits(need, wethDec)} ETH -> WETH`);
    try {
      // deposit() is payable and mints WETH in exchange for ETH
      const tx = await wethWithSigner.deposit({ value: need.toString() });
      await tx.wait();
    } catch (err) {
      console.warn("could not auto-wrap ETH to WETH:", err);
      console.warn("Please ensure your account holds enough WETH (or wrap ETH manually) before running this script.");
    }
  }

  await ensureAllowance(approveSchema, WETH, me, POOL, INITIAL_SUPPLY_WETH, rpc, pk, wethSym, wethDec, weth);
  const [w0, u0] = await Promise.all([weth.balanceOf(me), usdc.balanceOf(me)]);
  log(`balances before supply — ${wethSym}: ${formatUnits(w0, wethDec)}, ${usdcSym}: ${formatUnits(u0, usdcDec)}`);

  try {
    const poolIface = new ethers.Interface(["function supply(address,uint256,address,uint16)"]);
    const previewData = poolIface.encodeFunctionData("supply", [WETH, INITIAL_SUPPLY_WETH.toString(), me, 0]);
    console.log("preview aave supply calldata (len):", previewData.length, previewData.slice(0, 200));
  } catch (err) {
    console.warn("could not preview supply calldata:", err);
  }
  await execFromFile(aaveSupply, {
    asset: WETH,
    amount: INITIAL_SUPPLY_WETH.toString(),
    onBehalfOf: me,
    referralCode: 0
  }, rpc, pk, false);

  const [w1, u1] = await Promise.all([weth.balanceOf(me), usdc.balanceOf(me)]);
  log(`balances after  supply — ${wethSym}: ${formatUnits(w1, wethDec)}, ${usdcSym}: ${formatUnits(u1, usdcDec)}`);
  if (!(w1 <= w0)) throw new Error("Initial supply failed: WETH did not decrease");

  // ====== LOOP N times ======
  for (let i = 0; i < LOOPS; i++) {
  log(`== Loop ${i + 1}/${LOOPS} ==`);

    // 1) Borrow USDC
    const bBefore = await usdc.balanceOf(me);
    try {
      log(`borrow → ${formatUnits(BORROW_USDC_PER_LOOP, usdcDec)} ${usdcSym}`);
      await execFromFile(aaveBorrow, {
      asset: USDC,
      amount: BORROW_USDC_PER_LOOP.toString(),
      interestRateMode: 2, // variable
      referralCode: 0,
      onBehalfOf: me
      }, rpc, pk, false);
      const bAfter = await usdc.balanceOf(me);
      const dBorrow = bAfter - bBefore;
      log(`USDC change after borrow: +${formatUnits(dBorrow, usdcDec)} ${usdcSym}`);

    // 2) Swap USDC -> WETH on Uniswap V3 (exactInputSingle)
    // Approve USDC to router for the amount we’ll spend
    await ensureAllowance(approveSchema, USDC, me, ROUTER, BORROW_USDC_PER_LOOP, rpc, pk, usdcSym, usdcDec, usdc);

    const wBefore = await weth.balanceOf(me);
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    await execFromFile(uniExactInSgl, {
      contract: ROUTER,
      tokenIn: USDC,
      tokenOut: WETH,
      fee: FEE_TIER,
      recipient: me,
      deadline,
      amountIn: BORROW_USDC_PER_LOOP.toString(),
      amountOutMinimum: "0", // demo only; add slippage guard in prod
      sqrtPriceLimitX96: "0"
    }, rpc, pk, false);

    const wAfter = await weth.balanceOf(me);
    const acquiredWETH = BigInt(wAfter - wBefore);
  log(`swap USDC->WETH received ≈ ${formatUnits(acquiredWETH, wethDec)} ${wethSym}`);

    // 3) Supply acquired WETH
    if (acquiredWETH > 0n) {
      await ensureAllowance(approveSchema, WETH, me, POOL, acquiredWETH, rpc, pk, wethSym, wethDec, weth);
      const wS0 = await weth.balanceOf(me);
      await execFromFile(aaveSupply, {
        asset: WETH,
        amount: acquiredWETH.toString(),
        onBehalfOf: me,
        referralCode: 0
      }, rpc, pk, false);
      const wS1 = await weth.balanceOf(me);
      log(`re-supplied ${formatUnits(wS0 - wS1, wethDec)} ${wethSym}`);
    } else {
      console.warn("no WETH acquired from swap; skipping supply step (check fork liquidity/prices).");
    }
    } catch (err: any) {
      // concise error summary
      log(`ERROR: loop ${i + 1} failed — ${err.shortMessage ?? err.message ?? String(err)}`);
      // rethrow to preserve original behavior
      throw err;
    }
  }

  // ====== Done: print final balances ======
  const [wf, uf] = await Promise.all([weth.balanceOf(me), usdc.balanceOf(me)]);
  console.log(`\n== Final balances ==`);
  console.log(`${wethSym}: ${formatUnits(wf, wethDec)} | ${usdcSym}: ${formatUnits(uf, usdcDec)}`);
  console.log("✅ leverage loop complete (note: debt increased; unwind not included in this demo).");
}

main().catch((e) => { console.error(e); process.exit(1); });
