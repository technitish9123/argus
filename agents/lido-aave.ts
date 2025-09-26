// examples/lido-stake.ts
import { executeIntent } from "../src/index.js";
import { MainnetRegistry } from "./registry.js";
import { JsonRpcProvider, Wallet, Interface } from "ethers";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0xYOUR_KEY";

async function main() {
  // basic provider/wallet for balances (used by percent_of_balance)
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const erc20 = new Interface([
    "function balanceOf(address) view returns (uint256)",
  ]);

  // lets router compute percent_of_balance for ERC20 and native ETH
  const getBalanceWei = async (tokenAddr: `0x${string}`) => {
    if (
      tokenAddr.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    ) {
      return await provider.getBalance(wallet.address);
    }
    const data = erc20.encodeFunctionData("balanceOf", [wallet.address]);
    const ret = await provider.call({ to: tokenAddr, data });
    return erc20.decodeFunctionResult("balanceOf", ret)[0];
  };

  // Plan:
  // 1) Lido stake 0.01 ETH  → mints stETH
  // 2) Wrap 100% of stETH   → wstETH
  // 3) Supply 100% of wstETH on Aave v3 as collateral
  const mockPlan = [
    {
      protocol: "lido",
      action: "stake",
      params: {
        amount: { kind: "ether", value: "0.01" },
        referral: undefined,
      },
    },
    {
      protocol: "lido",
      action: "wrap", // wraps stETH into wstETH
      params: {
        assetSymbol: "STETH",
        amount: { kind: "percent_of_balance", value: 100 },
      },
    },
    {
      protocol: "aave",
      action: "supply",
      params: {
        assetSymbol: "WSTETH",
        amount: { kind: "percent_of_balance", value: 100 },
        useAsCollateral: true,
        onBehalfOf: undefined,
      },
    },
  ];

  const mockMeta = { chainId: 1 };

  const res = await executeIntent(
    "stake 0.01 ETH in lido → wrap all stETH to wstETH → supply all wstETH on aave",
    {
      rpcUrl: RPC_URL,
      privateKey: PRIVATE_KEY,
      chainIdDefault: 1,
      autoInsertApprovals: true,
      registry: MainnetRegistry,
      debug: true
    }
  );

  for (const step of res) {
    const tx = (step as any).tx;
    if (tx) {
      const sentTx = await wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : 0n
      });
      console.log(`Sent tx: ${sentTx.hash}`);
      await sentTx.wait();
      console.log(`Confirmed: ${sentTx.hash}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
