import { JsonRpcProvider, Wallet, Contract, Interface, getAddress } from "ethers";
import { applyDefaultsAndTemplates, enforceConstraints, normalizeAddressInputs } from "./helpers.js";
import { loadDSLFromUrl } from "./loader.js";
import { UnsupportedExecutionError } from "./errors.js";
import type { DSL } from "../core/types.js";

function jsonClone<T>(x: T): T {
  return x == null ? x : JSON.parse(JSON.stringify(x));
}
function substitute(v: any, inputs: Record<string, any>) {
  if (typeof v === "string" && v.startsWith("{") && v.endsWith("}")) {
    const key = v.slice(1, -1);
    if (!(key in inputs)) throw new Error(`Missing input for ${key}`);
    return inputs[key];
  }
  return v;
}
function buildTx(to: string, data: string, valueWei?: string, gasLimit?: number) {
  const tx: any = { to, data };
  if (valueWei) tx.value = valueWei;
  if (gasLimit) tx.gasLimit = gasLimit;
  return tx;
}

export async function execFromFile(
  path: string,
  rawInputs: Record<string, any>,
  rpcUrl: string,
  privateKey: string,
  simulateOnly = false
) {
  const dsl: DSL = await loadDSLFromUrl(path, rawInputs);
  // Log top-level execution info (avoid logging secrets)
  try {
    console.log("[exec] schema:", path);
    console.log("[exec] rpc:", rpcUrl, "simulateOnly:", simulateOnly);
    // rawInputs may contain user-provided data; avoid logging private keys
    const safeInputs = { ...rawInputs } as Record<string, any>;
    delete safeInputs.privateKey;
    console.log("[exec] rawInputs:", safeInputs);
  } catch (e) { /* ignore logging errors */ }

  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);

  const withDefaults = applyDefaultsAndTemplates(dsl, rawInputs, signer.address);
  const inputs = normalizeAddressInputs(dsl, withDefaults);
  enforceConstraints(dsl, inputs, signer.address);

  if (!dsl.execution.evm)
    throw new UnsupportedExecutionError("Only EVM execution supported in MVP");
  const exec = dsl.execution.evm;

  const iface = new Interface(exec.abi as any);
  const contract = new Contract(getAddress(String(substitute(exec.contract as any, inputs))), exec.abi as any, signer);

  // Build first-pass args
  const structure = (exec as any).structure ?? "object";
  let firstArgs: any;
  if (structure === "object") {
    firstArgs = jsonClone((exec as any).arg_object ?? {});
    for (const [k, v] of Object.entries(firstArgs)) {
      if (typeof v === "string" && v.includes("{min_out_computed}")) {
        firstArgs[k] = "0";
      } else {
        firstArgs[k] = substitute(v, inputs);
      }
    }
  } else if (structure === "tuple") {
    firstArgs = ((exec as any).arg_tuple ?? []).map((v: any) => substitute(v, inputs));
  } else {
    throw new Error(`Unknown structure: ${structure}`);
  }

  // Encode tx data
  const data = structure === "object"
    ? iface.encodeFunctionData(exec.method, [firstArgs])
    : iface.encodeFunctionData(exec.method, firstArgs);
  const targetAddr = (contract as any).target ?? (contract as any).address;
  if (process.env.DEBUG?.includes("exec")) {
    console.log("[exec] method:", exec.method);
    console.log("[exec] encoded data (len):", data.length, data.slice(0, 200));
  }
  let txReq = buildTx(targetAddr as string, data, (exec as any).value, (exec as any).gas_limit);

  // Try to simulate; ignore decode errors for non-view methods (approve, swap)
  let amountOut = "0";
  try {
    if (process.env.DEBUG?.includes("exec")) console.log("[exec] calling with txReq:", txReq);
    const callResult = await signer.call(txReq);
    if (callResult && callResult !== "0x") {
      const decoded = iface.decodeFunctionResult(exec.method, callResult);
      amountOut = decoded?.[0]?.toString?.() ?? "0";
    }
    // Log simulation result
    console.log("[exec] simulated_amountOut:", amountOut);
  } catch (err) {
    // Simulation can fail for non-view methods; log the error at debug level
    if (process.env.DEBUG?.includes("exec")) console.warn("[exec] simulate error:", err);
  }

  // If using {min_out_computed}, compute minOut from simulated amountOut and rebuild tx
  const usesMin =
    structure === "object" &&
    Object.values((exec as any).arg_object ?? {}).some(
      (v) => typeof v === "string" && v.includes("{min_out_computed}")
    );

  if (usesMin) {
    const slippageBps = Number((inputs as any).slippage_bps ?? 50);
    const minOut = (BigInt(amountOut) * BigInt(10_000 - slippageBps)) / 10_000n;

    const finalArgs: Record<string, any> = {};
    for (const [k, v] of Object.entries((exec as any).arg_object ?? {})) {
      finalArgs[k] = (typeof v === "string" && v.includes("{min_out_computed}"))
        ? minOut.toString()
        : substitute(v, inputs);
    }
    const finalData = iface.encodeFunctionData(exec.method, [finalArgs]);
    if (process.env.DEBUG?.includes("exec")) {
      console.log("[exec] final encoded data (len):", finalData.length, finalData.slice(0, 200));
    }
    txReq = buildTx(targetAddr as string, finalData, (exec as any).value, (exec as any).gas_limit);
  }

  if (simulateOnly) {
    console.log("[exec] returning simulation result for", path);
    return { simulated_amountOut: amountOut, tx: txReq };
  }

  // Send the transaction and log key details
  console.log("[exec] sending transaction to:", txReq.to, "method:", exec.method);
  const tx = await signer.sendTransaction(txReq);
  console.log("[exec] tx sent:", tx.hash, "waiting for receipt...");
  const rcpt = await tx.wait();
  try {
    if (rcpt) {
      console.log("[exec] txReceipt:", {
        hash: tx.hash,
        status: rcpt.status,
        gasUsed: rcpt.gasUsed?.toString?.(),
        logs: rcpt.logs?.length
      });
    } else {
      console.log("[exec] txReceipt: null/undefined for tx", tx.hash);
    }
  } catch (e) { /* ignore logging errors */ }

  return { txHash: tx.hash, amountOut, receipt: rcpt };
}
