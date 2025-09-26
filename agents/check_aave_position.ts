import { JsonRpcProvider, Contract, Wallet, formatUnits } from "ethers";
import { fileURLToPath } from "node:url";

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const PK = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave v3 Pool
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Minimal Aave Pool ABI snippets we need
const POOL_ABI = [
  // getReserveData returns many values; we'll index into the tuple
  "function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,address,address,address,address,uint8)",
  // helper to get token addresses for a reserve
  "function getReserveTokensAddresses(address) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
  "function getUserAccountData(address) view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)"
];

async function main() {
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const me = await wallet.getAddress();

  const pool = new Contract(POOL, POOL_ABI, provider);

  console.log(`RPC: ${RPC}`);
  console.log(`account: ${me}`);

  // Fetch reserve token addresses
  // Use the helper that returns token addresses (aToken, stableDebt, variableDebt)
  // This avoids decoding the large getReserveData tuple which can vary between
  // Aave versions / forks.
  const wethTokens = await pool.getReserveTokensAddresses(WETH).
    catch(() => null);
  const usdcTokens = await pool.getReserveTokensAddresses(USDC).
    catch(() => null);

  const aWeth = wethTokens ? wethTokens.aTokenAddress : "0x0000000000000000000000000000000000000000";
  const variableDebtUsdc = usdcTokens ? usdcTokens.variableDebtTokenAddress : "0x0000000000000000000000000000000000000000";

  console.log(`aToken (WETH): ${aWeth}`);
  console.log(`variableDebt (USDC): ${variableDebtUsdc}`);

  // Query balances safely (skip zero addresses)
  const usdcCtr = new Contract(USDC, ERC20, provider);
  const wethCtr = new Contract(WETH, ERC20, provider);
  const wethDec = await wethCtr.decimals();
  const usdcDec = await usdcCtr.decimals();

  const wethBal = await wethCtr.balanceOf(me);
  const usdcBal = await usdcCtr.balanceOf(me);

  let aWethBal = 0n;
  if (aWeth && aWeth !== "0x0000000000000000000000000000000000000000") {
    try {
      const aWethCtr = new Contract(aWeth, ERC20, provider);
      aWethBal = await aWethCtr.balanceOf(me);
    } catch (e: any) {
      console.warn("could not read aWETH balance:", e?.message || e);
    }
  } else {
    console.log("aWETH address is zero — possibly the reserve has no aToken or returned empty from pool.getReserveData");
  }

  let varDebtUsdcBal = 0n;
  if (variableDebtUsdc && variableDebtUsdc !== "0x0000000000000000000000000000000000000000") {
    try {
      const varDebtUsdcCtr = new Contract(variableDebtUsdc, ERC20, provider);
      varDebtUsdcBal = await varDebtUsdcCtr.balanceOf(me);
    } catch (e: any) {
      console.warn("could not read variable debt USDC balance:", e?.message || e);
    }
  }

  console.log(`\nOn-chain balances:`);
  console.log(`WETH (wallet): ${formatUnits(wethBal, wethDec)}`);
  console.log(`USDC (wallet): ${formatUnits(usdcBal, usdcDec)}`);
  console.log(`aWETH (aToken): ${aWethBal ? formatUnits(aWethBal, wethDec) : "<not-available>"}`);
  console.log(`variableDebt USDC: ${varDebtUsdcBal ? formatUnits(varDebtUsdcBal, usdcDec) : "0"}`);

  // User account data (health factor etc)
  const acct = await pool.getUserAccountData(me);
  // Values are in Ray/Wei base; healthFactor is typically a ray-scaled number
  console.log(`\nAave account data:`);
  console.log(`totalCollateralBase: ${acct.totalCollateralBase.toString()}`);
  console.log(`totalDebtBase: ${acct.totalDebtBase.toString()}`);
  console.log(`availableBorrowsBase: ${acct.availableBorrowsBase.toString()}`);
  console.log(`ltv: ${acct.ltv.toString()}`);
  console.log(`currentLiquidationThreshold: ${acct.currentLiquidationThreshold.toString()}`);
  console.log(`healthFactor: ${acct.healthFactor.toString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
