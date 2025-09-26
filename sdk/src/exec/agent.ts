import { execFromFile } from "./executor";
import { validateDSL } from "../core/validator";
import type { DSL } from "../core/types";

export async function runAgentAction({
  schemaPath,
  inputs,
  rpcUrl,
  privateKey,
  simulateOnly = false
}: {
  schemaPath: string;
  inputs: Record<string, any>;
  rpcUrl: string;
  privateKey: string;
  simulateOnly?: boolean;
}) {
  // Validate inputs against schema
  const validation = validateDSL(inputs);
  if (!validation.ok) {
    throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
  }

  // Log invocation (avoid printing secrets)
  try {
    const safeInputs = { ...inputs } as Record<string, any>;
    delete safeInputs.privateKey;
    console.log("[agent] running schema:", schemaPath, "simulateOnly:", simulateOnly);
    console.log("[agent] inputs:", safeInputs);
  } catch (e) { /* ignore logging errors */ }

  // Execute action using the agent engine
  const result = await execFromFile(
    schemaPath,
    inputs,
    rpcUrl,
    privateKey,
    simulateOnly
  );

  // Log result summary
  try {
    console.log("[agent] result:", {
      txHash: (result as any).txHash,
      simulated_amountOut: (result as any).simulated_amountOut,
      amountOut: (result as any).amountOut
    });
  } catch (e) { /* ignore logging errors */ }

  return result;
}
