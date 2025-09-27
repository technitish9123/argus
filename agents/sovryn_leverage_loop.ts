/**
 * Sovryn Leveraged Yield Loop (Rootstock)
 * Aggressive/average risk: Loops collateral and borrows to maximize yield, with health factor monitoring.
 *
 * Steps:
 * 1. Supply RBTC (or rUSDT) as collateral on Sovryn.
 * 2. Borrow rUSDT against collateral.
 * 3. Swap rUSDT for more RBTC using Sovryn AMM.
 * 4. Re-supply RBTC as collateral.
 * 5. Repeat up to a safe health factor (e.g., >1.5).
 * 6. Monitor health factor; auto-deleverage if below threshold.
 *
 * Usage:
 *   export RPC_URL=https://public-node.testnet.rsk.co
 *   export CHAIN_ID=31
 *   export SOVRYN_POOL_ADDR=<Sovryn lending pool>
 *   export RBTC_ADDR=<RBTC token>
 *   export RUSDT_ADDR=<rUSDT token>
 *   export AMM_ROUTER_ADDR=<Sovryn AMM router>
 *   export MAX_LOOPS=3
 *   export MIN_HEALTH_FACTOR=1.5
 *   export BORROW_RUSDT_PER_LOOP=10000000
 *   export INITIAL_SUPPLY_RBTC=10000000000000000
 *   export PRIVATE_KEY=0x...
 *   pnpm tsx agents/sovryn_leverage_loop.ts
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

// ====== CONFIG ======
const CHAIN_ID = Number(process.env.CHAIN_ID || 31);
const MAX_LOOPS = Number(process.env.MAX_LOOPS || 3);
const MIN_HEALTH_FACTOR = Number(process.env.MIN_HEALTH_FACTOR || 1.5);
const BORROW_RUSDT_PER_LOOP = BigInt(process.env.BORROW_RUSDT_PER_LOOP || 10_000_000n); // 10 rUSDT (6dp)
const INITIAL_SUPPLY_RBTC = BigInt(process.env.INITIAL_SUPPLY_RBTC || 10_000_000_000_000_000n); // 0.01 RBTC

const SOVRYN_POOL = getAddress(process.env.SOVRYN_POOL_ADDR || "0x0000000000000000000000000000000000000000");
const RBTC = getAddress(process.env.RBTC_ADDR || "0x0000000000000000000000000000000000000000");
const wRBTC = getAddress(process.env.RBTC_ADDR || "0x967F8799aF07dF1534d48A95a5C9FEBE92c53AE0");

const RUSDT = getAddress(process.env.RUSDT_ADDR || "0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96");
const AMM_ROUTER = getAddress(process.env.AMM_ROUTER_ADDR || "0x0000000000000000000000000000000000000000");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const POOL_ABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)",
  // common lending pool operations (minimal signatures used by agents)
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)"
];

// Minimal AMM/router ABI for Sovryn swaps (common flavors)
const AMM_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  // some Sovryn-style AMMs may expose RBTC-specific helpers — include a generic fallback
  "function swapExactTokensForRBTC(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)"
];

// Schema URLs
const approveSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/approve.json"));
const borrowSchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/borrow.json"));
const supplySchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/supply.json"));
const repaySchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/repay.json"));
const withdrawSchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/withdraw.json"));
const swapSchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/swap.json"));
function fp(p: string) { return pathToFileURL(p).href; }
function log(...args: any[]) {
  const out = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log('[agent]', out);
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

async function main() {
  const rpc = process.env.RPC_URL || "http://127.0.0.1:8545";
  const pk  = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  if (!pk) throw new Error("Set PRIVATE_KEY");
  if (!rpc) throw new Error("Set RPC_URL");

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(pk, provider);
  const me = await signer.getAddress();

  const rbtc = new Contract(RBTC, ERC20_ABI, provider);
  const rusdt = new Contract(RUSDT, ERC20_ABI, provider);
  // TODO: Add Sovryn pool and AMM router ABIs as needed

  // Detect whether RBTC address is an ERC-20 or the native coin (RBTC):
  let rbtcIsErc20 = true;
  let curRbtcBal: bigint;
  try {
    // Try ERC-20 balanceOf; some RBTC addresses may be native coin (no balanceOf)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    curRbtcBal = await rbtc.balanceOf(me);
  } catch (err) {
    // Not an ERC-20 (or call failed) — treat as native balance
    rbtcIsErc20 = false;
    curRbtcBal = await provider.getBalance(me);
  }

  // Initial supply
  log(`== Initial supply ==`);
  if (curRbtcBal < INITIAL_SUPPLY_RBTC) {
    throw new Error("Insufficient RBTC balance for initial supply");
  }
  // Supply RBTC to Sovryn pool using the supply schema
  const dry = process.env.DEBUG_DRY_RUN === "1";
  // Native coins (RBTC) do not need ERC-20 approvals
  if (!dry && rbtcIsErc20) {
    await ensureAllowance(approveSchema, RBTC, me, SOVRYN_POOL, INITIAL_SUPPLY_RBTC, rpc, pk, "RBTC", 18, rbtc);
  }
  log(`→ supplying initial RBTC (${INITIAL_SUPPLY_RBTC.toString()}) to pool ${SOVRYN_POOL} (dry=${dry})`);
  const supplyOut = await execFromFile(supplySchema, {
    asset: RBTC,
    amount: INITIAL_SUPPLY_RBTC.toString(),
    onBehalfOf: me
  }, rpc, pk, dry);
  if (dry) log('supply dry->', supplyOut);

  // Loop
  for (let i = 0; i < MAX_LOOPS; i++) {
    log(`== Loop ${i + 1}/${MAX_LOOPS} ==`);

    // 1) Borrow rUSDT
    log(`→ borrowing rUSDT ${BORROW_RUSDT_PER_LOOP.toString()}...`);
    const borrowOut = await execFromFile(borrowSchema, {
      asset: RUSDT,
      amount: BORROW_RUSDT_PER_LOOP.toString(),
      onBehalfOf: me
    }, rpc, pk, dry);
    if (dry) log('borrow dry->', borrowOut);

    // 2) Ensure AMM has allowance to pull rUSDT (for swap)
    if (!dry) {
      await ensureAllowance(approveSchema, RUSDT, me, AMM_ROUTER, BORROW_RUSDT_PER_LOOP, rpc, pk, "rUSDT", 6, rusdt);
    }

    // 3) Swap rUSDT -> RBTC via AMM router
    const pathTokens = [RUSDT, RBTC];
    const amountIn = BORROW_RUSDT_PER_LOOP.toString();
    const amountOutMin = "0"; // TODO: compute slippage-protected minimum using getAmountsOut
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    log(`→ swapping rUSDT for RBTC via AMM (dry=${dry})`);
    const swapOut = await execFromFile(swapSchema, {
      amountIn,
      amountOutMin,
      path: pathTokens,
      to: me,
      deadline
    }, rpc, pk, dry);
    if (dry) log('swap dry->', swapOut);

    // 4) Re-supply RBTC proceeds back into the pool
    // NOTE: swapOut shape depends on executor. We'll conservatively use the borrowed amount as placeholder.
    const reed = BORROW_RUSDT_PER_LOOP.toString();
    if (!dry) {
      // fetch RBTC balance change in production, here we re-use placeholder
      await ensureAllowance(approveSchema, RBTC, me, SOVRYN_POOL, INITIAL_SUPPLY_RBTC, rpc, pk, "RBTC", 18, rbtc);
    }
    log(`→ re-supplying swapped RBTC into pool (dry=${dry})`);
    const resupplyOut = await execFromFile(supplySchema, {
      asset: RBTC,
      amount: reed,
      onBehalfOf: me
    }, rpc, pk, dry);
    if (dry) log('resupply dry->', resupplyOut);

    // 5) Optionally check health factor and break if too low
    try {
      const pool = new Contract(SOVRYN_POOL, POOL_ABI, provider);
      const ud = await pool.getUserAccountData(me);
      const hf = Number(ud.healthFactor || ud[5] || 0) / 1e18;
      log(`→ healthFactor=${hf}`);
      if (hf < MIN_HEALTH_FACTOR) {
        log(`health factor ${hf} below threshold ${MIN_HEALTH_FACTOR}, stopping loops.`);
        break;
      }
    } catch (e) {
      log('warn: failed to read health factor', e);
    }
  }

  // TODO: Monitor health factor, auto-deleverage if needed
}

main().catch((e) => { console.error(e); process.exit(1); });
