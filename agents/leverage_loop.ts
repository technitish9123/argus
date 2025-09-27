/**
 * Leverage loop + live monitor:
 *  - Supply WETH to Aave v3
 *  - Borrow USDC
 *  - Swap USDC -> WETH on Uniswap V3
 *  - Supply the new WETH
 *  - Repeat N loops
 *  - Then, every minute, print position status from Aave v3
 *
 * Run (on a mainnet fork):
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

// Minimal Aave v3 Pool ABI pieces we need
const POOL_ABI = [
  // v3: same signature idea as v2, returns base-currency figures + ratios
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  // reserve data (we only use aTokenAddress, variableDebtTokenAddress, current rates)
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"
];

/** ====== helpers ====== */
function fp(p: string) { return pathToFileURL(p).href; }

// concise agent logger used for user-facing output
function log(...args: any[]) {
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

// RAY (1e27) -> % APR string
function rayToAprPct(ray: bigint): string {
  const apr = parseFloat(ethers.formatUnits(ray, 27)) * 100;
  return `${apr.toFixed(2)}%`;
}

async function startLiveMonitor(opts: {
  provider: JsonRpcProvider,
  me: string,
  weth: Contract,
  usdc: Contract,
}) {
  const { provider, me } = opts;
  const pool = new Contract(POOL, POOL_ABI, provider);

  // discover token wrappers from reserves
  const wethRes = await pool.getReserveData(WETH);
  const usdcRes = await pool.getReserveData(USDC);
  console.log("WETH reserve data:", wethRes);
console.log("USDC reserve data:", usdcRes);



  const aWethAddr = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const vdUsdcAddr = usdcRes.variableDebtTokenAddress;

  console.log("aWETH:", aWethAddr);
  console.log("vdUSDC:", vdUsdcAddr);

  const wethCode = await provider.getCode(aWethAddr);
  const usdcDebtCode = await provider.getCode(vdUsdcAddr);

  console.log("aWETH has code?", wethCode !== "0x");
  console.log("vdUSDC has code?", usdcDebtCode !== "0x");

  if (wethCode === "0x") {
    console.warn("aWETH contract does not exist at", aWethAddr, "- skipping live monitor.");
    return;
  }
  if (usdcDebtCode === "0x") {
    console.warn("vdUSDC contract does not exist at", vdUsdcAddr, "- skipping live monitor.");
    return;
  }

  const aWETH = new Contract(aWethAddr, ERC20_ABI, provider);
  const vdUSDC = new Contract(vdUsdcAddr, ERC20_ABI, provider);

  const [wethDec, usdcDec] = await Promise.all([
    opts.weth.decimals(), opts.usdc.decimals()
  ]);

  // one-shot printer (we’ll call it every minute)
  const tick = async () => {
    try {
      const now = new Date().toISOString();
      const [
        aWethBal,
        vdUsdcBal,
        accountData,
        wethResNow,
        usdcResNow
      ] = await Promise.all([
        aWETH.balanceOf(me),
        vdUSDC.balanceOf(me),
        pool.getUserAccountData(me),
        pool.getReserveData(WETH),
        pool.getReserveData(USDC),
      ]);

      const hf = parseFloat(ethers.formatUnits(accountData.healthFactor, 18));
      const ltvBps = Number(accountData.ltv); // 0-10000
      const ltvPct = (ltvBps / 100).toFixed(2) + "%";

      const supplyWeth = ethers.formatUnits(aWethBal, wethDec);
      const debtUsdc = ethers.formatUnits(vdUsdcBal, usdcDec);

      const supplyApr = rayToAprPct(wethResNow.currentLiquidityRate);
      const borrowApr = rayToAprPct(usdcResNow.currentVariableBorrowRate);

      console.log("");
      console.log("== Aave v3 Position @", now, "==");
      console.log(`Supplied WETH (aWETH): ${supplyWeth}`);
      console.log(`Variable Debt USDC:     ${debtUsdc}`);
      console.log(`LTV (policy):           ${ltvPct}`);
      console.log(`Health Factor:          ${hf.toFixed(4)}`);
      console.log(`WETH supply APR:        ${supplyApr}`);
      console.log(`USDC var borrow APR:    ${borrowApr}`);
      console.log("====================================");
    } catch (err: any) {
      console.warn("monitor error:", err?.message ?? String(err));
    }
  };

  // initial + every minute
  await tick();
  const id = setInterval(tick, 60_000);

  // graceful shutdown
  const stop = () => { clearInterval(id); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

/** ====== main ====== */
async function main() {
  const rpc = process.env.RPC_URL || "http://127.0.0.1:8545";
  const pk  = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  if (!process.env.PRIVATE_KEY) {
    console.warn("WARNING: PRIVATE_KEY not set — using Anvil default key for local testing only. Do NOT use this key on mainnet.");
  }
  if (!rpc) throw new Error("Set RPC_URL (e.g. export RPC_URL=http://127.0.0.1:8545)");

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(pk, provider);
  const me = await signer.getAddress();

  const weth = new Contract(WETH, ERC20_ABI, provider);
  const usdc = new Contract(USDC, ERC20_ABI, provider);

  const wethWithSigner = new Contract(WETH, [...ERC20_ABI, "function deposit() payable"], signer);

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
  const curWethBal = await weth.balanceOf(me);
  if (curWethBal < INITIAL_SUPPLY_WETH) {
    const need = INITIAL_SUPPLY_WETH - curWethBal;
    log(`insufficient WETH balance (${formatUnits(curWethBal, wethDec)}), wrapping ${formatUnits(need, wethDec)} ETH -> WETH`);
    try {
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
      log(`ERROR: loop ${i + 1} failed — ${err.shortMessage ?? err.message ?? String(err)}`);
      throw err;
    }
  }

  // ====== Done: print final balances ======
  const [wf, uf] = await Promise.all([weth.balanceOf(me), usdc.balanceOf(me)]);
  console.log(`\n== Final balances ==`);
  console.log(`${wethSym}: ${formatUnits(wf, wethDec)} | ${usdcSym}: ${formatUnits(uf, usdcDec)}`);
  console.log("✅ leverage loop complete (note: debt increased; unwind not included in this demo).");

  // ====== Start live monitor (every minute) ======
  await startLiveMonitor({ provider, me, weth, usdc });
}

main().catch((e) => { console.error(e); process.exit(1); });
