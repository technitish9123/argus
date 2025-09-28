/**
 * PYUSD Subscription Agent
 * - Wrap ETH → WETH
 * - Swap WETH → USDC
 * - Swap USDC → PYUSD
 * - Pay subscription in PYUSD
 */

import { JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits } from "ethers";
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

// Addresses
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const PYUSD = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const RECIPIENT = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";

// Fees
const FEE_ETH_USDC = 500;
const FEE_USDC_PYUSD = 500;

// Subscription target
const TARGET_PYUSD = "1";
const SWAP_ETH = "0.01";

const transferSchema = fp(path.join(__dirname, "../sdk/schemas/erc20/actions/transfer.json"));
const log = (...a: any[]) => console.log("[agent][pyusd-sub]", ...a);

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PK, provider);
  const me = signer.address;

  log("starting subscription demo", { me, PYUSD, RECIPIENT });

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];

  const token = new Contract(PYUSD, erc20Abi, provider);
  const decimals = Number(await token.decimals());
  const target = parseUnits(TARGET_PYUSD, decimals);

  log("== tick 1/1 ==");

  let bal = BigInt(await token.balanceOf(me));
  log(`balance=${formatUnits(bal, decimals)} PYUSD | need=${TARGET_PYUSD}`);

  if (bal < target) {
    log(`⚠️ insufficient PYUSD — swapping ${SWAP_ETH} ETH → USDC → PYUSD`);

    // Contracts
    const wethAbi = [
      "function deposit() payable",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address) view returns (uint256)"
    ];
    const weth = new Contract(WETH, wethAbi, signer);
    const usdc = new Contract(USDC, erc20Abi, signer);

    const routerAbi = [
      "function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) returns (uint256)"
    ];
    const router = new Contract(UNISWAP_V3_ROUTER, routerAbi, signer);

    const amountInEth = parseUnits(SWAP_ETH, 18);

    // Manual nonce management
    let nonce = await provider.getTransactionCount(me);

    // Step 1: Wrap ETH → WETH
    const tx1 = await weth.deposit({ value: amountInEth, nonce: nonce++ });
    await tx1.wait();
    log(`wrapped ${SWAP_ETH} ETH into WETH`);

    // Step 2: Approve router for WETH
    const tx2 = await weth.approve(UNISWAP_V3_ROUTER, amountInEth, { nonce: nonce++ });
    await tx2.wait();
    log("approved WETH to router");

    // Step 3: Swap WETH → USDC
    const swapEthUsdc = [
      WETH,
      USDC,
      FEE_ETH_USDC,
      me,
      Math.floor(Date.now() / 1000) + 1200,
      amountInEth.toString(),
      "0",
      "0"
    ];
    const tx3 = await router.exactInputSingle(swapEthUsdc, { gasLimit: 1_000_000, nonce: nonce++ });
    await tx3.wait();
    log("swap WETH→USDC done");

    // Step 4: Approve router for USDC
    const usdcBal = await usdc.balanceOf(me);
    const tx4 = await usdc.approve(UNISWAP_V3_ROUTER, usdcBal, { nonce: nonce++ });
    await tx4.wait();
    log("approved USDC to router");

    // Step 5: Swap USDC → PYUSD
    const swapUsdcPyusd = [
      USDC,
      PYUSD,
      FEE_USDC_PYUSD,
      me,
      Math.floor(Date.now() / 1000) + 1200,
      usdcBal.toString(),
      "0",
      "0"
    ];
    const tx5 = await router.exactInputSingle(swapUsdcPyusd, { gasLimit: 1_000_000, nonce: nonce++ });
    await tx5.wait();
    log("swap USDC→PYUSD done");

    // Recheck PYUSD balance
    bal = BigInt(await token.balanceOf(me));
    log("post-swap balance=", formatUnits(bal, decimals));
  }

  if (bal >= target) {
    try {
      log(`sending subscription payment ${formatUnits(target, decimals)} PYUSD → ${RECIPIENT}`);
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
