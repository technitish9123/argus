// src/compile/router.ts
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Action } from "../intent/schemas.js";

/**
 * A small structural type for any address/role registry you pass in.
 * This is intentionally minimal; if you already export a richer type elsewhere,
 * structural typing will make this compatible.
 */
export type AddressRegistry = {
  getContract(protocol: string, role: string, chainId: number): `0x${string}`;
};

/**
 * One execution step produced by the router. The executor/runner will later
 * import the JSON at dslUrl (your action schema) and adapt it to a full DSL.
 */
export type PlanStep = {
  dslUrl: string;                    // file:// URL to schemas/<protocol>/actions/<action>.json
  inputs: Record<string, any>;       // user-provided params (lightly normalized)
  simulateOnly?: boolean;            // optional hint
  meta?: Record<string, any>;        // extra info for later preflights (e.g. percent_of_balance)
};

export type BuildOpts = {
  chainIdDefault?: number;
  account?: `0x${string}`;
  /**
   * Optional: if provided, the router can pre-populate meta for percent_of_balance flows.
   * (This implementation records the spec in meta and leaves exact wei resolution
   * to a later phase so we don't need on-chain calls here.)
   */
  registry?: AddressRegistry;
  getBalanceWei?: (tokenAddr: `0x${string}`) => Promise<bigint>;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
// …/src/compile/router.ts -> …/schemas
const DSL_ROOT = path.resolve(HERE, "../../schemas");

/** Resolve a file:// URL for schemas/<protocol>/actions/<action>.json */
export function actionUrl(protocol: string, action: string): string {
  const p = path.join(DSL_ROOT, protocol, "actions", `${action}.json`);
  return pathToFileURL(p).href;
}

/**
 * Normalize inputs just enough to keep them transport-safe.
 * - Leave Amount specs as-is (executor or approvals preflight may resolve them).
 * - Copy through everything else verbatim.
 * - Collect any "percent_of_balance" occurrences into meta for later use.
 */
function normalizeInputs(params: Record<string, any>) {
  const inputs: Record<string, any> = {};
  const meta: Record<string, any> = {};

  for (const [k, v] of Object.entries(params ?? {})) {
    inputs[k] = v;

    if (v && typeof v === "object" && "kind" in v && (v as any).kind === "percent_of_balance") {
      meta.percentOfBalance = meta.percentOfBalance ?? [];
      (meta.percentOfBalance as any[]).push({ key: k, spec: v });
    }
  }

  return { inputs, meta: Object.keys(meta).length ? meta : undefined };
}

/**
 * Generic, schema-first router: it does not branch on protocol/action.
 * It simply resolves the on-disk JSON schema URL and passes normalized inputs.
 */
export async function planFromAction(a: Action, opts: BuildOpts = {}): Promise<PlanStep[]> {
  const _chainId = a.chainId ?? opts.chainIdDefault ?? 1; // currently unused but kept for future hooks
  const dslUrl = actionUrl(a.protocol, a.action);

  const { inputs, meta } = normalizeInputs(a.params ?? {});
  return [{ dslUrl, inputs, meta }];
}
