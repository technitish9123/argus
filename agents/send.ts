// examples/sendTx.ts
import { executeIntent } from "../src/intent/execute.js";
import { ParsedIntent } from "../src/intent/schemas.js";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContract } from "viem";

// --- Config ---
const rpcUrl = "http://127.0.0.1:8545"; // anvil fork
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`; // account #0

const account = privateKeyToAccount(privateKey);
const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // account #1

const publicClient = createPublicClient({ transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

// --- Contracts ---
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

async function main() {
  console.log("Sender:", account.address);
  console.log("Recipient:", recipient);

  // --- ETH transfer intent ---
  const ethIntent: ParsedIntent = {
    version: "intent/v1",
    actions: [
      {
        id: "transfer.eth",
        protocol: "erc20",
        action: "transfer",
        params: {
          token: "0x0000000000000000000000000000000000000000", // ETH
          to: recipient,
          amount: { type: "ether", value: 1 }, // send 1 ETH
        },
      },
    ],
  };

  console.log("\nPlanning ETH transfer...");
  await executeIntent(ethIntent, {
    rpcUrl,
    privateKey,
    getBalanceWei: async (tokenAddr: `0x${string}`) => {
      if (tokenAddr === "0x0000000000000000000000000000000000000000") {
        return await publicClient.getBalance({ address: account.address });
      }
      return 0n;
    },
  });

  console.log("Broadcasting ETH transfer...");
  const ethHash = await walletClient.sendTransaction({
    account,
    to: recipient as `0x${string}`,
    value: parseUnits("1", 18),
  });
  console.log("✅ ETH tx:", ethHash);

  // --- USDC transfer ---
  const usdc = getContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  const usdcAmount = parseUnits("500", 6); // 500 USDC
  console.log("\nBroadcasting USDC transfer...");
  const usdcHash = await usdc.write.transfer([recipient, usdcAmount]);
  console.log("✅ USDC tx:", usdcHash);

  // --- Balances ---
  const ethBal = await publicClient.getBalance({ address: recipient });
  const usdcBal = await usdc.read.balanceOf([recipient]);

  console.log("\nFinal balances of recipient:");
  console.log("ETH:", ethBal.toString(), "(wei)");
  console.log("USDC:", usdcBal.toString(), "(raw units, 6 decimals)");
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
