// src/intent/execute.ts
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Interface,
  parseUnits,
  MaxUint256,
  toBeHex,
  isAddress,
  getAddress,
  ZeroAddress,
  FunctionFragment,
} from "ethers";
import type { PlanStep } from "../compile/router.js";
import { planFromAction } from "../compile/router.js";
import type { Action, ParsedIntent } from "./schemas.js";
import { AddressRegistry } from "../ports.js";

export type ApprovalCtx = {
  caller?: string;
  chainIdDefault?: number;
  erc20ApproveDslUrl?: string;
  registry?: AddressRegistry;
};

export type ExecuteCtx = ApprovalCtx & {
  rpcUrl?: string;
  privateKey?: string;
  autoInsertApprovals?: boolean;
  // llmClient removed
  debug?: boolean;
  getBalanceWei?: (tokenAddr: `0x${string}`) => Promise<bigint>;
};

/* -----------------------------------------------------------------------------
 * Protocol folder aliasing (logical protocol -> on-disk directory)
 * -------------------------------------------------------------------------- */
const PROTOCOL_DIR_ALIASES: Record<string, string> = {
  aave: "aave_v3",
  uniswap: "uniswap_v3",
  // balancer: "balancer_v2",
  // curve: "curve_v2",
};

/** Map schema/dir proto → registry key proto (e.g., aave_v3 → aave). */
function canonicalizeProtocolForRegistry(proto?: string): string {
  const p = (proto ?? "").toLowerCase();
  if (!p) return p;
  if (p === "aave_v3") return "aave";
  if (p === "uniswap_v3") return "uniswap";
  return p;
}

/** Generate alternative proto keys to try in the registry. */
function altProtosForLookup(proto?: string): string[] {
  const raw = (proto ?? "").toLowerCase();
  const canon = canonicalizeProtocolForRegistry(raw);
  const hyphen = raw.replace(/_/g, "-");
  const base = raw.replace(/_v\d+$/, "");
  const out = [canon, raw, hyphen, base].filter(Boolean);
  // de-dup while preserving order
  return Array.from(new Set(out));
}

function rewriteProtocolDirInDslUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    // Expect: .../schemas/<proto>/actions/<file>.json
    const i = parts.lastIndexOf("schemas");
    if (i >= 0 && parts[i + 1]) {
      const proto = parts[i + 1];
      const alias = PROTOCOL_DIR_ALIASES[proto];
      if (alias && alias !== proto) {
        parts[i + 1] = alias;
        u.pathname = parts.join("/");
        return u.href;
      }
    }
  } catch { }
  return null;
}

async function importJson<T = any>(url: string): Promise<T> {
  // @ts-ignore JSON import assertion in Node ESM
  return (await import(url, { assert: { type: "json" } } as any)).default as T;
}

function rewriteApproveProtocolInUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    // .../schemas/<proto>/actions/<file>.json
    const i = parts.lastIndexOf("schemas");
    const proto = parts[i + 1];
    const actions = parts[i + 2];
    const file = parts[i + 3] || "";

    if (
      i >= 0 &&
      actions === "actions" &&
      file.toLowerCase() === "approve.json" &&
      proto !== "erc20"
    ) {
      parts[i + 1] = "erc20";
      u.pathname = parts.join("/");
      return u.href;
    }
  } catch { }
  return null;
}

async function importSchemaWithAliases(
  url: string
): Promise<{ schema: any; resolvedUrl: string }> {
  // First, fix any mis-protocol’d approve.json
  const approveFixed = rewriteApproveProtocolInUrl(url);
  const first = approveFixed && approveFixed !== url ? approveFixed : url;

  try {
    const schema = await importJson(first);
    return { schema, resolvedUrl: first };
  } catch (e) {
    // Next, try protocol dir aliasing (e.g., aave -> aave_v3)
    const alt = rewriteProtocolDirInDslUrl(first);
    if (alt && alt !== first) {
      // Also re-apply approve rewrite if aliasing changed the proto folder
      const alt2 = rewriteApproveProtocolInUrl(alt) || alt;
      const schema = await importJson(alt2);
      return { schema, resolvedUrl: alt2 };
    }
    throw e;
  }
}

function canonicalizeProtocolForAction(
  protocol: string,
  action: string
): string {
  const a = action.toLowerCase();
  // Always perform approvals via ERC20 schema
  if (a === "approve") return "erc20";
  return protocol;
}

/* -----------------------------------------------------------------------------
 * Canonicalize action names (planner/LLM aliases -> schema filenames)
 * -------------------------------------------------------------------------- */
function canonicalizeActionName(protocol: string, action: string): string {
  const p = protocol.toLowerCase();
  const a = action.toLowerCase();
  if (p === "lido" && (a === "stake" || a === "deposit")) return "submit";
  if (p === "aave" && a === "deposit") return "supply";
  if (p === "etherfi" && a === "stake") return "deposit";
  return action;
}

/* -----------------------------------------------------------------------------
 * Paths & misc helpers
 * -------------------------------------------------------------------------- */
function resolveSchemasRootFromActionUrl(actionDslUrl: string): string {
  const filePath = fileURLToPath(actionDslUrl);
  const actionsDir = path.dirname(filePath);
  const protocolDir = path.dirname(actionsDir);
  const schemasRoot = path.dirname(protocolDir);
  return schemasRoot;
}

export function inferApproveDslUrlFrom(actionDslUrl: string): string {
  const root = resolveSchemasRootFromActionUrl(actionDslUrl);
  const approvePath = path.join(root, "erc20", "actions", "approve.json");
  return pathToFileURL(approvePath).href;
}

function isNativeToken(addr: unknown): boolean {
  if (typeof addr !== "string") return false;
  const a = addr.toLowerCase();
  return (
    a === "native" ||
    a === "eth" ||
    a === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
}

/* -----------------------------------------------------------------------------
 * Registry helpers
 * -------------------------------------------------------------------------- */
function resolveRoleViaRegistry(
  registry: AddressRegistry | undefined,
  protos: string[],
  role: string,
  chainId: number
): string | undefined {
  if (!registry) return undefined;
  for (const p of protos) {
    try {
      const addr = registry.getContract(p, role, chainId);
      if (addr && isAddress(addr)) return getAddress(addr); // normalize checksum
      if (addr && !isAddress(addr)) {
        throw new Error(
          `Registry returned non-address for ${p}.${role}: ${addr}`
        );
      }
    } catch { }
  }
  return undefined;
}

/* -----------------------------------------------------------------------------
 * Approval hint reader (alias-aware)
 * -------------------------------------------------------------------------- */
/** Read schema hints for approvals; supports multiple styles (see comments). */
async function getSchemaHints(step: PlanStep) {
  const { schema, resolvedUrl } = await importSchemaWithAliases(step.dslUrl);
  (step as any).dslUrl = resolvedUrl;

  const protocol =
    (schema?.protocol && typeof schema.protocol === "object"
      ? schema.protocol.name
      : schema?.protocol) || "";

  let debits: any[] = [];
  if (Array.isArray(schema?.["x-hints-debits"])) {
    debits = schema["x-hints-debits"];
  } else if (
    schema?.["x-debits"] &&
    Array.isArray(schema["x-debits"]["x-hints"])
  ) {
    debits = schema["x-debits"]["x-hints"];
  } else if (schema?.["x-debitAmountKey"]) {
    debits = [
      {
        amountKey: schema["x-debitAmountKey"],
        tokenParam: schema["x-debitTokenParam"],
        tokenRole: schema["x-debitTokenRole"],
      },
    ];
  }

  return {
    protocol,
    spenderRole: schema?.["x-spenderRole"] as string | undefined,
    debits,
    fallbackContract: schema?.execution?.evm?.contract as string | undefined,
  };
}

export async function expandWithApprovals(
  steps: PlanStep[],
  ctx: ExecuteCtx = {}
): Promise<PlanStep[]> {
  if (!ctx.autoInsertApprovals) return steps;

  const out: PlanStep[] = [];
  const chainId = ctx.chainIdDefault ?? 1;
  const seenPair = new Set<string>();

  for (const step of steps) {
    const hints = await getSchemaHints(step);

    const protoKeys = altProtosForLookup(hints.protocol);
    const protoKeysWithErc20 = Array.from(new Set([...protoKeys, "erc20"]));
    let spender: string | undefined;

    if (hints.spenderRole) {
      spender =
        resolveRoleViaRegistry(
          ctx.registry,
          protoKeys,
          hints.spenderRole,
          chainId
        ) ?? hints.fallbackContract;
    } else {
      spender = hints.fallbackContract;
    }

    for (const d of hints.debits) {
      let token: string | undefined;

      // 1) Prefer explicit param name
      const paramKey = d.tokenParam as string | undefined;
      if (!token && paramKey && typeof step.inputs?.[paramKey] === "string") {
        const v = step.inputs[paramKey] as string;
        token = isAddress(v)
          ? getAddress(v)
          : coerceAddressOrRole(v, {
            paramName: paramKey,
            defaultProtocol: canonicalizeProtocolForRegistry(hints.protocol),
            chainId,
            registry: ctx.registry,
          });
      }

      if (!token && d.tokenRole) {
        token = resolveRoleViaRegistry(
          ctx.registry,
          protoKeysWithErc20,
          d.tokenRole,
          chainId
        );
      }

      // 2) Role-based token
      if (!token && d.tokenRole) {
        token = resolveRoleViaRegistry(
          ctx.registry,
          protoKeys,
          d.tokenRole,
          chainId
        );
      }

      // 3) Asset symbol fallback (common in planner outputs)
      if (!token && typeof step.inputs?.assetSymbol === "string") {
        token = coerceAddressOrRole(step.inputs.assetSymbol, {
          paramName: "assetSymbol",
          defaultProtocol: canonicalizeProtocolForRegistry(hints.protocol),
          chainId,
          registry: ctx.registry,
        });
      }

      // 4) Generic fallbacks
      if (!token && typeof (step.inputs as any)?.token === "string") {
        const v = (step.inputs as any).token;
        token = isAddress(v)
          ? getAddress(v)
          : coerceAddressOrRole(v, {
            paramName: "token",
            defaultProtocol: canonicalizeProtocolForRegistry(hints.protocol),
            chainId,
            registry: ctx.registry,
          });
      }
      if (
        !token &&
        typeof (step.inputs as any)?.contract === "string" &&
        isAddress((step.inputs as any).contract)
      ) {
        token = getAddress((step.inputs as any).contract);
      }

      if (!spender || !token || isNativeToken(token)) {
        // nothing to approve
        continue;
      }

      try {
        if (isAddress(spender)) spender = getAddress(spender);
        if (isAddress(token)) token = getAddress(token);
      } catch (e) {
        if (ctx.debug) console.debug("[approvals] checksum error:", e);
      }

      const key = `${token.toLowerCase()}|${spender.toLowerCase()}`;
      if (!seenPair.has(key)) {
        const approveDslUrl =
          ctx.erc20ApproveDslUrl ?? inferApproveDslUrlFrom(step.dslUrl);

        out.push({
          dslUrl: approveDslUrl,
          inputs: {
            contract: token, // ERC20 approve expects token as the contract
            spender,
            amount: MaxUint256.toString(),
          },
        });
        seenPair.add(key);
      }
    }

    out.push(step);
  }

  return out;
}

/* -----------------------------------------------------------------------------
 * Planning helpers
 * -------------------------------------------------------------------------- */
async function heuristicPromptToPlanSteps(
  prompt: string,
  ctx: ExecuteCtx
): Promise<PlanStep[]> {
  const p = prompt.toLowerCase().trim();
  const m = /(stake|deposit)\s+([\d.]+)\s*(eth|wei)?\s+(in|to)?\s*lido/.exec(p);
  if (m) {
    const amountStr = m[2];
    const isEth = (m[3] ?? "eth").includes("eth");
    const wei = isEth ? parseUnits(amountStr, 18).toString() : amountStr;

    const a: Action = {
      protocol: "lido",
      action: "submit",
      params: {
        referral: "0x0000000000000000000000000000000000000000",
        value: wei,
      },
      chainId: ctx.chainIdDefault ?? 1,
    };
    const steps = await planFromAction(a, {
      chainIdDefault: ctx.chainIdDefault ?? 1,
      registry: ctx.registry,
      getBalanceWei: ctx.getBalanceWei,
    });
    steps[0].inputs.value = wei; // tx value for payable
    return steps;
  }

  throw new Error(
    "Cannot heuristically parse prompt. Call executeIntent with a structured intent (ParsedIntent / Action[] / PlanStep[]) instead."
  );
}

async function intentToPlan(
  intent: ParsedIntent,
  ctx: ExecuteCtx
): Promise<PlanStep[]> {
  const steps: PlanStep[] = [];
  for (const a of intent.actions) {
    const canonAction = canonicalizeActionName(a.protocol, a.action);
    const canonProtocol = canonicalizeProtocolForAction(
      a.protocol,
      canonAction
    );
    const canon = { ...a, protocol: canonProtocol, action: canonAction };

    const s = await planFromAction(canon, {
      chainIdDefault: canon.chainId ?? ctx.chainIdDefault,
      registry: ctx.registry,
      getBalanceWei: ctx.getBalanceWei,
    });

    if ((canon as any).params?.value && !s[0].inputs.value) {
      s[0].inputs.value = (canon as any).params.value;
    }
    steps.push(...s);
  }
  return steps;
}

/* -----------------------------------------------------------------------------
 * Public APIs
 * -------------------------------------------------------------------------- */
export async function executeIntent<
  T extends string | ParsedIntent | Action[] | PlanStep[]
>(input: T, ctx?: ExecuteCtx): Promise<PlanStep[]>;

export async function executeIntent(
  input: string | ParsedIntent | Action[] | PlanStep[],
  ctx: ExecuteCtx = {}
): Promise<PlanStep[]> {
  let steps: PlanStep[];

  if (typeof input === "string") {
    if (ctx.debug) console.debug("[executeIntent] planning from prompt");
    // LLM parsing removed — use heuristic only (or require structured intent)
    steps = await heuristicPromptToPlanSteps(input, ctx);
  } else if (Array.isArray(input)) {
    if (input.length > 0 && "dslUrl" in (input[0] as any)) {
      steps = input as PlanStep[];
    } else {
      const actions = input as Action[];
      steps = await intentToPlan({ actions, meta: {} } as ParsedIntent, ctx);
    }
  } else if (input && typeof input === "object" && "actions" in input) {
    steps = await intentToPlan(input as ParsedIntent, ctx);
  } else {
    throw new Error("Unsupported input to executeIntent");
  }

  steps = await expandWithApprovals(steps, ctx);

  // Onchain execution for ERC20 transfer actions
  const ethers = await import('ethers');
  const results = [];
  for (const step of steps) {
    if (
      step?.dslUrl?.includes('erc20') &&
      step?.inputs?.token &&
      step?.inputs?.to &&
      step?.inputs?.amount
    ) {
      if (!ctx.rpcUrl) throw new Error("rpcUrl required for on-chain execution");
      if (!ctx.privateKey) throw new Error("privateKey required for on-chain execution");
      const provider = new ethers.JsonRpcProvider(ctx.rpcUrl);
      const wallet = new ethers.Wallet(ctx.privateKey, provider);
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)'
      ];
      const contract = new ethers.Contract(step.inputs.token, erc20Abi, wallet);
      const tx = await contract.transfer(step.inputs.to, step.inputs.amount);
      const receipt = await tx.wait();
      results.push({
        ...step,
        txHash: tx.hash,
        receipt,
      });
    } else {
      results.push(step);
    }
  }

  if (ctx.debug) console.debug("[executeIntent] planned steps:", steps);
  return results;
}

function getSchemaSignature(schema: any): string | undefined {
  if (typeof schema?.["x-abi"] === "string") return schema["x-abi"];
  if (typeof schema?.execution?.evm?.signature === "string")
    return schema.execution.evm.signature;
  const propConst = schema?.properties?.["x-abi"]?.const;
  return typeof propConst === "string" ? propConst : undefined;
}

function getSchemaContractRole(schema: any): string | undefined {
  const evmRole = schema?.execution?.evm?.contractRole;
  if (typeof evmRole === "string") return evmRole;
  const xRole = schema?.["x-targetRole"];
  if (typeof xRole === "string") return xRole;
  const propRole = schema?.properties?.contract?.const;
  return typeof propRole === "string" ? propRole : undefined;
}

function getSchemaContractAddress(schema: any): string | undefined {
  const execAddr = schema?.execution?.evm?.contract;
  if (typeof execAddr === "string" && isAddress(execAddr))
    return getAddress(execAddr);
  const constAddr = schema?.properties?.contract?.const;
  if (typeof constAddr === "string" && isAddress(constAddr))
    return getAddress(constAddr);
  return undefined;
}

function protocolFromDslUrl(dslUrl: string): string | undefined {
  try {
    const u = new URL(dslUrl);
    const parts = u.pathname.split("/");
    const i = parts.lastIndexOf("schemas");
    const p = i >= 0 ? parts[i + 1] : undefined;
    return p;
  } catch {
    return undefined;
  }
}

/** Look up a default value for a param from the JSON-Schema (params.properties.<name>.default). */
function getParamDefault(schema: any, paramName: string): any {
  return schema?.properties?.params?.properties?.[paramName]?.default;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse "aave.pool.wsteth" or "aave.pool" into { protocol, role } */
function parseRolePath(s: string): { protocol?: string; role?: string } | null {
  if (typeof s !== "string" || /^0x/i.test(s)) return null;
  const parts = s
    .split(".")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length >= 2) return { protocol: parts[0], role: parts[1] }; // ignore trailing qualifiers
  if (parts.length === 1) return { role: parts[0] };
  return null;
}

/** Accepts address, "<proto>.<role>[.<...>]" OR bare symbol (e.g., "WSTETH") and resolves via registry. */
function coerceAddressOrRole(
  value: any,
  {
    allowZeroDefault = false,
    paramName = "address",
    defaultProtocol,
    chainId,
    registry,
  }: {
    allowZeroDefault?: boolean;
    paramName?: string;
    defaultProtocol?: string;
    chainId?: number;
    registry?: AddressRegistry;
  } = {}
): string {
  // address fast-path
  if (typeof value === "string" && isAddress(value)) return getAddress(value);

  // role-path (e.g., "aave.pool.wsteth" → use "aave.pool")
  const parsed = parseRolePath(value);
  if (parsed && registry && chainId) {
    const proto = parsed.protocol ?? defaultProtocol ?? "";
    if (!proto) {
      if (allowZeroDefault) return ZeroAddress;
      throw new Error(
        `Cannot resolve role for ${paramName}: missing protocol in "${value}"`
      );
    }
    try {
      const got = registry.getContract(
        canonicalizeProtocolForRegistry(proto),
        parsed.role ?? "",
        chainId
      );
      if (!isAddress(got))
        throw new Error(
          `Registry returned non-address for ${proto}.${parsed.role}: ${got}`
        );
      return getAddress(got);
    } catch {
      // try alternates
      const alt = resolveRoleViaRegistry(
        registry,
        altProtosForLookup(proto),
        parsed.role ?? "",
        chainId
      );
      if (alt) return alt;
      if (allowZeroDefault) return ZeroAddress;
      throw new Error(
        `Unknown role "${canonicalizeProtocolForRegistry(proto)}.${parsed.role
        }" for ${paramName}`
      );
    }
  }

  // bare symbol (e.g., "WSTETH") → try defaultProtocol, then generic fallbacks
  if (typeof value === "string" && registry && chainId) {
    const sym = value.trim().toLowerCase();
    const tried = new Set<string>();
    const tryProto = (p?: string) => {
      if (!p) return undefined;
      const keys = altProtosForLookup(p);
      for (const k of keys) {
        const tag = `${k}:${sym}`;
        if (tried.has(tag)) continue;
        tried.add(tag);
        try {
          const got = registry.getContract(k, sym, chainId);
          if (isAddress(got)) return getAddress(got);
        } catch { }
      }
      return undefined;
    };

    let addr =
      tryProto(defaultProtocol) ||
      tryProto("lido") || // common source of steth/wsteth
      tryProto("erc20"); // generic bucket if you keep ERC20s by symbol

    if (addr) return addr;
  }

  if (allowZeroDefault) return getAddress(ZeroAddress);
  throw new Error(`Invalid address/role for ${paramName}: ${value}`);
}

/** Tolerant input key lookup (maps ABI param names like stETHAmount ↔ amount, and asset ← assetSymbol). */
function valueForParam(
  paramName: string,
  inputs: Record<string, any>,
  schema?: any
): any {
  if (paramName in inputs) return inputs[paramName];

  const map = (schema?.["x-argMap"] ?? schema?.["x-argsMap"]) as
    | Record<string, string>
    | undefined;
  if (map && typeof map === "object") {
    const key = map[paramName];
    if (key && key in inputs) return inputs[key];
  }

  const n = normalizeName(paramName);
  const has = (k: string) => inputs[k] !== undefined;

  // "amount" family
  if (n.includes("amount") || n.endsWith("amount") || n.endsWith("amt")) {
    if (has("amount")) return inputs.amount;
    if (has("amountIn")) return inputs.amountIn;
    if (has("amountOut")) return inputs.amountOut;
    if (has("value")) return inputs.value;
    if (has("assets")) return inputs.assets;
    if (has("shares")) return inputs.shares;
  }

  // recipient / to
  if (n === "recipient" || n === "to") {
    if (has("recipient")) return inputs.recipient;
    if (has("to")) return inputs.to;
  }

  // owner / from
  if (n === "owner" || n === "from") {
    if (has("owner")) return inputs.owner;
    if (has("from")) return inputs.from;
  }

  // token / asset (address) — accept assetSymbol and let coercer resolve it
  if (n === "token" || n === "asset" || n.endsWith("token")) {
    if (has("asset")) return inputs.asset;
    if (has("token")) return inputs.token;
    if (has("assetSymbol")) return inputs.assetSymbol; // important for Aave supply
    if (has("tokenIn")) return inputs.tokenIn;
    if (has("contract")) return inputs.contract; // approval step passes ERC20 as contract
  }

  // pool / poolId
  if (n === "pool" || n === "poolid") {
    if (has("pool")) return inputs.pool;
    if (has("poolId")) return inputs.poolId;
  }

  // positional fallback
  return inputs[`arg${paramName}`];
}

function isUintOrInt(abiType: string): boolean {
  const t = abiType.toLowerCase();
  return t.startsWith("uint") || t.startsWith("int");
}
function isArrayType(abiType: string): boolean {
  return abiType.trim().endsWith("[]");
}
function baseTypeOfArray(abiType: string): string {
  return abiType.trim().replace(/\[\]$/, "");
}

/** Convert DSL Amount object (or plain string/number) into a BigNumberish-compatible value. */
function toBigNumberish(
  v: any,
  {
    defaultDecimals = 18,
    paramName = "amount",
  }: { defaultDecimals?: number; paramName?: string } = {}
): bigint | string {
  if (typeof v === "string") {
    if (v.startsWith("0x")) return v;
    if (/^\d+$/.test(v)) return BigInt(v);
  }
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));

  if (v && typeof v === "object" && v.kind != null) {
    const kind = String(v.kind).toLowerCase();
    const val = v.value;
    if (val == null) throw new Error(`Missing value for ${paramName} amount`);

    if (kind === "wei") return BigInt(val);
    if (kind === "ether") return parseUnits(String(val), 18);
    if (kind === "units")
      return parseUnits(String(val), v.decimals ?? defaultDecimals);
    if (kind === "percent_of_balance") {
      throw new Error(
        `Unresolved percent_of_balance in ${paramName}; ensure router resolved balances`
      );
    }
  }

  throw new Error(
    `invalid BigNumberish for ${paramName}: ${JSON.stringify(v)}`
  );
}

/** Coerce a value for a given ABI param type (address/uint/int/arrays). */
function coerceForAbi(
  value: any,
  abiParam: { type: string; name?: string },
  ctx: {
    proto: string;
    chainId: number;
    registry?: AddressRegistry;
    defaultDecimals?: number;
  }
): any {
  const name = (abiParam.name || "").trim();
  const type = (abiParam.type || "").toLowerCase();

  // Arrays recurse
  if (isArrayType(type)) {
    const inner = baseTypeOfArray(type);
    if (!Array.isArray(value)) throw new Error(`Expected array for ${name}`);
    return value.map((el, i) =>
      coerceForAbi(el, { type: inner, name: `${name}[${i}]` }, ctx)
    );
  }

  if (type === "address" || type.startsWith("address")) {
    const allowDefault = [
      "referral",
      "onBehalfOf",
      "recipient",
      "owner",
    ].includes(name);
    return coerceAddressOrRole(value, {
      allowZeroDefault: allowDefault,
      paramName: name || "address",
      defaultProtocol: ctx.proto,
      chainId: ctx.chainId,
      registry: ctx.registry,
    });
  }

  if (isUintOrInt(type)) {
    return toBigNumberish(value, {
      defaultDecimals: ctx.defaultDecimals ?? 18,
      paramName: name || "amount",
    });
  }

  // bytes / bytesN
  if (type === "bytes" || /^bytes\d+$/.test(type)) {
    if (typeof value === "string" && value.startsWith("0x")) return value;
    throw new Error(`Invalid ${type} for ${name}: expected hex string`);
  }

  return value;
}

export async function executeIntentWithSignature<
  T extends string | ParsedIntent | Action[] | PlanStep[]
>(input: T, ctx?: ExecuteCtx): Promise<PlanStep[]>;

export async function executeIntentWithSignature(
  input: string | ParsedIntent | Action[] | PlanStep[],
  ctx: ExecuteCtx = {}
): Promise<PlanStep[]> {
  const planned = await executeIntent(input, ctx);
  const chainId = ctx.chainIdDefault ?? 1;
  const out: PlanStep[] = [];

  for (const step of planned) {
    const { schema, resolvedUrl } = await importSchemaWithAliases(step.dslUrl);
    (step as any).dslUrl = resolvedUrl;

    // 1) Signature
    const rawSig = getSchemaSignature(schema);
    let iface: Interface, fnName: string;

    if (rawSig) {
      const sig = rawSig.trim().startsWith("function")
        ? rawSig.trim()
        : `function ${rawSig.trim()}`;
      iface = new Interface([sig]);
      const fnFrag = iface.fragments.find((f) => f.type === "function") as
        | FunctionFragment
        | undefined;
      if (!fnFrag)
        throw new Error(`No function fragment in signature for ${step.dslUrl}`);
      fnName = fnFrag.name;
    } else if (
      Array.isArray(schema?.execution?.evm?.abi) &&
      typeof schema?.execution?.evm?.method === "string"
    ) {
      iface = new Interface(schema.execution.evm.abi);
      fnName = schema.execution.evm.method;
    } else {
      throw new Error(`Missing function signature for ${step.dslUrl}.`);
    }

    const fn = iface.getFunction(fnName);
    const inputs = (step.inputs ?? {}) as Record<string, any>;

    // 2) Resolve target "to"
    const protoFromSchema =
      (schema?.protocol && typeof schema.protocol === "object"
        ? schema.protocol.name
        : schema?.protocol) || undefined;

    const protoRaw = protoFromSchema ?? protocolFromDslUrl(step.dslUrl) ?? "";
    const protoForReg = canonicalizeProtocolForRegistry(protoRaw);
    const protoKeys = altProtosForLookup(protoRaw);
    const protoKeysWithErc20 = Array.from(new Set([...protoKeys, "erc20"]));

    let to: string | undefined = getSchemaContractAddress(schema);
    const role = getSchemaContractRole(schema);

    if (!to && role) {
      const roleNorm = role.toLowerCase();
      const tryKeys = Array.from(new Set([...protoKeys, "lido", "erc20"]));
      to = resolveRoleViaRegistry(ctx.registry, tryKeys, roleNorm, chainId);
    }

    if (!to && protoForReg === "erc20") {
      // Prefer explicit 'contract', fallback to token/asset/assetSymbol
      const tokenish =
        inputs.contract ??
        inputs.token ??
        inputs.asset ??
        (typeof inputs.assetSymbol === "string"
          ? coerceAddressOrRole(inputs.assetSymbol, {
            paramName: "assetSymbol",
            defaultProtocol: protoForReg,
            chainId,
            registry: ctx.registry,
          })
          : undefined);

      if (typeof tokenish === "string") {
        to = coerceAddressOrRole(tokenish, {
          paramName: "contract",
          defaultProtocol: protoForReg,
          chainId,
          registry: ctx.registry,
        });
      }
    }

    if (!to && typeof (step as any).to === "string") to = (step as any).to;

    if (!to) {
      if (ctx.debug)
        console.debug("[signature] resolution failed", {
          dslUrl: step.dslUrl,
          proto: protoForReg,
          role,
        });
      throw new Error(
        `Target contract not found for ${step.dslUrl}. Provide contract address or resolvable role.`
      );
    }

    to = getAddress(to);

    // 3) Build args (tolerant names, schema defaults, sensible fallbacks)
    if (!fn) {
      throw new Error(
        `Function fragment not found for ${fnName} in ${step.dslUrl}`
      );
    }
    const rawArgs = fn.inputs.map((p, idx) => {
      const paramName = (p.name || "").trim();
      let v = valueForParam(paramName, inputs, schema);

      // JSON-Schema default (params.properties.<name>.default)
      if (v === undefined) {
        const defVal = getParamDefault(schema, paramName);
        if (defVal !== undefined) v = defVal;
      }

      // Hard defaults for common EVM shapes
      if (v === undefined && paramName === "referral") {
        // Use canonical ZERO_ADDRESS from core/address
        // import { ZERO_ADDRESS } from "../core/address.js"; (add import if not present)
        v = "0x0000000000000000000000000000000000000000";
      }
      if (v === undefined && paramName === "referralCode") v = 0; // Aave v3 default
      if (v === undefined && paramName === "onBehalfOf") {
        if (ctx.caller) v = ctx.caller;
        else
          throw new Error(
            `Missing "onBehalfOf" and ctx.caller not provided for ${fnName}`
          );
      }

      if (v === undefined) v = inputs[`arg${idx}`];
      if (v === undefined) {
        throw new Error(
          `Missing argument "${paramName || `arg${idx}`}" for ${fnName} in ${step.dslUrl
          }`
        );
      }
      return v;
    });

    // 3.1) Coerce each arg to its ABI type (addresses, numbers, arrays, bytes, etc.)
    const coercedArgs = rawArgs.map((v, i) =>
      coerceForAbi(v, fn.inputs[i], {
        proto: protoForReg,
        chainId,
        registry: ctx.registry,
        defaultDecimals: 18,
      })
    );

    // 4) Payable value inference (if not provided)
    let valueHex: string | undefined;
    const vIn = inputs.value;
    if (vIn != null) {
      valueHex =
        typeof vIn === "string" && vIn.startsWith("0x")
          ? vIn
          : toBeHex(BigInt(vIn));
    } else if ((fn as any).payable) {
      const amt = inputs?.amount;
      if (amt && typeof amt === "object") {
        const kind = String(amt.kind ?? "").toLowerCase();
        const val = amt.value;
        if (val != null) {
          if (kind === "wei") valueHex = toBeHex(BigInt(val));
          else if (kind === "ether")
            valueHex = toBeHex(parseUnits(String(val), 18));
          else if (kind === "units")
            valueHex = toBeHex(parseUnits(String(val), amt.decimals ?? 18));
        }
      }
    }

    // 5) Encode & attach tx
    const data = iface.encodeFunctionData(fnName, coercedArgs);
    (step as any).tx = {
      chainId,
      to,
      data,
      value: valueHex ?? "0x0",
      function: fn ? fn.format() : undefined,
      args: coercedArgs,
    };

    out.push(step);
  }

  if (ctx.debug) {
    console.debug(
      "[executeIntentWithSignature] txs:",
      out.map((s) => (s as any).tx)
    );
  }
  return out;
}
