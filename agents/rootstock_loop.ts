/**
 * Rootstock Leverage Loop (Sovryn)
 * - Supplies WRBTC (via iRBTC LoanToken)
 * - Borrows rUSDT (via iUSDT LoanToken)
 * - Swaps rUSDT -> WRBTC via Sovryn AMM
 * - Re-supplies WRBTC
 * - Prints telemetry every minute
 *
 * ENV:
 *   export RPC_URL=https://public-node.rsk.co
 *   export PRIVATE_KEY=0x...
 *   pnpm tsx agents/rootstock_sovryn_loop.ts
 */

import { JsonRpcProvider, Wallet, Contract, ethers, getAddress, formatUnits } from "ethers";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFromFile } from "@apdsl/agent-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fp = (p: string) => pathToFileURL(p).href;

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PK = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
if (!PK) throw new Error("Set PRIVATE_KEY");

// === Sovryn Rootstock mainnet defaults ===
const WRBTC = getAddress("0x542fDA317318eBF1d3DEAf76E0b632741A7e677d");
const RUSDT = getAddress("0xef213441a85df4d7acbdae0cf78004e1e486bb96");
const V2_ROUTER = getAddress("0x98aCE08D2b759a265ae326F010496bcD63C15afc");
const IWRBTC = getAddress("0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A"); // iRBTC LoanToken
const IRUSDT = getAddress("0x849C47f9C259E9D62F289BF1b2729039698D8387"); // iUSDT LoanToken

// Params
const LOOPS = Number(process.env.LOOPS || 1);
const INITIAL_SUPPLY_WRBTC = BigInt(process.env.INITIAL_SUPPLY_WRBTC_WEI || 10_000_000_000_000_000n); // 0.01
const BORROW_RUSDT_PER_LOOP = BigInt(process.env.BORROW_RUSDT_PER_LOOP || 25_000_000n); // 25 rUSDT

// ABIs
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const LOANTOKEN_ABI = [
  "function mint(address receiver, uint256 depositAmount) returns (uint256)",
  "function burn(address receiver, uint256 burnAmount) returns (uint256 loanAmountPaid)",
  "function borrow(uint256 borrowAmount, uint256 collateralAmount, address receiver, address loanTokenSent, address collateralTokenSent) returns (uint256)"
];

const V2_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

// Schemas
const approveSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/approve.json"));
const supplySchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/supply.json"));
; // placeholder for iRBTC mint
const borrowSchema = fp(path.join(__dirname, "../sdk/schemas/sovryn/actions/borrow.json"));

// logger
const log = (...a: any[]) => console.log("[agent]", ...a);

async function ensureAllowance(
  schemaUrl: string,
  tokenAddr: string,
  owner: string,
  spender: string,
  need: bigint,
  rpc: string,
  pk: string,
  sym: string,
  dec: number,
  erc: Contract
) {
  const cur = await erc.allowance(owner, spender);
  if (cur >= need) return;
  log(`approve ${sym} → ${spender} for ${formatUnits(need, dec)} ${sym}`);
  await execFromFile(schemaUrl, {
    contract: tokenAddr,
    spender,
    amount: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  }, rpc, pk, false);
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PK, provider);
  const me = await signer.getAddress();

  const wrbtc = new Contract(WRBTC, ERC20_ABI, provider);
  const rusdt = new Contract(RUSDT, ERC20_ABI, provider);
  const [wrbtcDec, rusdtDec, wrbtcSym, rusdtSym] = await Promise.all([
    wrbtc.decimals(), rusdt.decimals(), wrbtc.symbol(), rusdt.symbol()
  ]);

  const amm = new Contract(V2_ROUTER, V2_ROUTER_ABI, provider);
  const iRBTC = new Contract(IWRBTC, LOANTOKEN_ABI, signer);
  const iUSDT = new Contract(IRUSDT, LOANTOKEN_ABI, signer);

  log(`Rootstock Sovryn leverage loop`);
  log(`WRBTC=${WRBTC}, rUSDT=${RUSDT}`);
  log(`iRBTC=${IWRBTC}, iUSDT=${IRUSDT}, AMM=${V2_ROUTER}`);

  // Step 0: check balances
  const wrbtcBal = await wrbtc.balanceOf(me);
  if (wrbtcBal < INITIAL_SUPPLY_WRBTC) {
    throw new Error(`Need at least ${formatUnits(INITIAL_SUPPLY_WRBTC, wrbtcDec)} ${wrbtcSym} (have ${formatUnits(wrbtcBal, wrbtcDec)})`);
  }

  // Supply WRBTC → iRBTC (mint)
  if (supplySchema) {
    await ensureAllowance(approveSchema, WRBTC, me, IWRBTC, INITIAL_SUPPLY_WRBTC, RPC_URL, PK, wrbtcSym, wrbtcDec, wrbtc);
    log(`supply ${formatUnits(INITIAL_SUPPLY_WRBTC, wrbtcDec)} ${wrbtcSym} via iRBTC.mint`);
    await execFromFile(supplySchema, {
      contract: IWRBTC,
      amount: INITIAL_SUPPLY_WRBTC.toString(),
      receiver: me
    }, RPC_URL, PK, false);
  } else {
    log("supplySchema not set — skipping supply (demo mode)");
  }

  // Loops
  for (let i = 0; i < LOOPS; i++) {
    log(`== loop ${i + 1}/${LOOPS} ==`);

    // 1. Borrow rUSDT
    if (borrowSchema) {
      log(`borrow ${formatUnits(BORROW_RUSDT_PER_LOOP, rusdtDec)} ${rusdtSym} via iUSDT.borrow`);
      await execFromFile(borrowSchema, {
        contract: IRUSDT,
        borrowAmount: BORROW_RUSDT_PER_LOOP.toString(),
        collateralAmount: 0,
        receiver: me,
        loanTokenSent: RUSDT,
        collateralTokenSent: WRBTC
      }, RPC_URL, PK, false);
    } else {
      log("borrowSchema not set — skipping borrow (demo mode)");
    }

    // 2. Swap rUSDT → WRBTC
    const rusdtBal = await rusdt.balanceOf(me);
    if (rusdtBal > 0n) {
      await ensureAllowance(approveSchema, RUSDT, me, V2_ROUTER, rusdtBal, RPC_URL, PK, rusdtSym, rusdtDec, rusdt);
      const path = [RUSDT, WRBTC];
      const amounts = await amm.getAmountsOut(rusdtBal, path);
      const quoted = BigInt(amounts[amounts.length - 1].toString());
      const minOut = (quoted * 99n) / 100n; // 1% slippage
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      log(`swap ${formatUnits(rusdtBal, rusdtDec)} ${rusdtSym} -> ${wrbtcSym}`);
      await amm.connect(signer).swapExactTokensForTokens(
        rusdtBal,
        minOut,
        path,
        me,
        deadline,
        { gasLimit: 1_500_000 }
      );
    } else {
      log("no rUSDT to swap");
    }

    // 3. Re-supply WRBTC
    const newBal = await wrbtc.balanceOf(me);
    if (supplySchema && newBal > 0n) {
      await ensureAllowance(approveSchema, WRBTC, me, IWRBTC, newBal, RPC_URL, PK, wrbtcSym, wrbtcDec, wrbtc);
      log(`resupply ${formatUnits(newBal, wrbtcDec)} ${wrbtcSym}`);
      await execFromFile(supplySchema, {
        contract: IWRBTC,
        amount: newBal.toString(),
        receiver: me
      }, RPC_URL, PK, false);
    }
  }

  // Print balances
  const [fW, fU] = await Promise.all([wrbtc.balanceOf(me), rusdt.balanceOf(me)]);
  log(`final — ${wrbtcSym}:${formatUnits(fW, wrbtcDec)} | ${rusdtSym}:${formatUnits(fU, rusdtDec)}`);

  // Telemetry
  setInterval(async () => {
    const [w, u] = await Promise.all([wrbtc.balanceOf(me), rusdt.balanceOf(me)]);
    log(`tick — ${wrbtcSym}:${formatUnits(w, wrbtcDec)} ${rusdtSym}:${formatUnits(u, rusdtDec)}`);
  }, 60_000);
}

main().catch((e) => { console.error(e); process.exit(1); });
