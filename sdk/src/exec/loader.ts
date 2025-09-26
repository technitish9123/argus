// src/exec/loader.ts
// Loads and validates a DSL JSON schema from a file URL

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { DSL } from "../core/types.js";
import { validateDSL } from "../core/validator.js";
import { Interface, getAddress } from "ethers";

// Dynamically import a JSON file as a module
async function importJson<T = any>(fileUrl: string): Promise<T> {
  return (await import(fileUrl, { assert: { type: "json" } })).default as T;
}

// Resolve the index.json for a given action schema URL
function resolveIndexUrl(actionUrl: string): string {
  const p = fileURLToPath(actionUrl);
  const indexFs = path.join(path.dirname(path.dirname(p)), "index.json");
  return pathToFileURL(indexFs).href;
}

// Guess parameter type from JSON schema
function guessTypeFromParamSchema(ps: any): string {
  if (!ps) return "string";
  if (typeof ps.pattern === "string" && ps.pattern.includes("{40}"))
    return "address";
  if (ps.enum) return "enum";
  if (ps.type === "integer") return "uint";
  if (ps.type === "string") {
    if (ps.pattern && /^[\^\[]?0-9/.test(ps.pattern)) return "uint";
    return "string";
  }
  return "string";
}

// Build argument object for template substitution
function buildArgObject(params: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(params)) out[key] = `{${key}}`;
  return out;
}

/**
 * Loads a DSL schema from a file URL and validates it.
 * @param url - File URL to the DSL schema
 * @param runtimeInputs - Optional runtime inputs for validation
 */
export async function loadDSLFromUrl(
  url: string,
  runtimeInputs?: Record<string, any>
): Promise<DSL> {
  const doc: any = await importJson(url);

  // 1) Already a FULL DSL doc? Validate (envelope validator will passthrough) and return.
  if (doc && doc.dsl_version && doc.protocol && doc.execution) {
    const v = validateDSL(doc);
    if (!v.ok) throw new Error("Schema invalid: " + v.errors.join("; "));
    return v.doc as DSL;
  }

  // 2) Normalize "action" forms:
  //    a) instance: { contract, method, params, value?, "x-abi": ... }
  //    b) schema:   { properties: { contract:{const|enum}, method:{const|enum}, params:{properties,required}, value? }, "x-abi"|xAbi|abi: ... }
  let contractFieldRaw: any;
  let methodFieldRaw: any;
  let paramsSchema: any;
  let valueWeiRaw: any;
  let xAbiRaw: any = doc["x-abi"] ?? doc["xAbi"] ?? doc["abi"];

  if (doc && doc.properties) {
    const props = doc.properties;
    contractFieldRaw =
      props?.contract?.const ??
      props?.contract?.enum?.[0] ??
      runtimeInputs?.contract ??
      props?.contract;

    methodFieldRaw =
      props?.method?.const ??
      props?.method?.enum?.[0] ??
      runtimeInputs?.method ??
      props?.method;

    paramsSchema = props?.params ?? {};
    valueWeiRaw =
      props?.value?.const ??
      props?.value?.default ??
      runtimeInputs?.value ??
      undefined;

    // pick up x-abi under properties as well
    xAbiRaw =
      xAbiRaw ??
      props?.["x-abi"]?.const ??
      props?.["x-abi"]?.enum?.[0] ??
      props?.xAbi?.const ??
      props?.xAbi?.enum?.[0] ??
      props?.abi?.const ??
      props?.abi?.enum?.[0];
  } else {
    // instance-style
    contractFieldRaw = doc.contract;
    methodFieldRaw = doc.method;
    paramsSchema = doc.params ?? {};
    valueWeiRaw = doc.value;
  }

  // Derive method name from ABI if missing
  if (!methodFieldRaw && xAbiRaw) {
    const xAbiStr = Array.isArray(xAbiRaw)
      ? String(xAbiRaw[0])
      : String(xAbiRaw);
    const m = xAbiStr.match(
      /function\s+([A-Za-z0-9_]+)\s*\(|^\s*([A-Za-z0-9_]+)\s*\(/
    );
    if (m) methodFieldRaw = m[1] || m[2];
  }

  if (!methodFieldRaw) throw new Error(`Action schema missing "method"`);
  if (!contractFieldRaw) throw new Error(`Action schema missing "contract"`);
  if (!xAbiRaw) throw new Error(`Action schema missing "x-abi"`);

  // 3) Resolve protocol index + addresses
  const indexUrl = resolveIndexUrl(url);
  const index = await importJson(indexUrl);
  if (process.env.DEBUG?.includes("loader")) {
    console.log(
      `[loader] index: ${indexUrl} roles=[${Object.keys(
        index?.roles ?? {}
      ).join(", ")}]`
    );
  }

  const protocolName = index.protocol || index.name || "unknown";
  const version = String(index.version ?? index.version_str ?? "1").replace(
    /^v/i,
    ""
  );
  const chainId = Number(index.chainId ?? index.chain_id ?? 1);

  function resolveRoleOrAddress(keyOrAddr: string): string {
    const isAddr = /^0x[0-9a-fA-F]{40}$/.test(keyOrAddr);
    if (isAddr) return keyOrAddr;

    const roles = (index as any).roles ?? {};
    const v = roles[keyOrAddr];
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const byStr = v[String(chainId)];
      const byNum = v[chainId as any];
      if (typeof byStr === "string") return byStr;
      if (typeof byNum === "string") return byNum;
    }

    const legacyMaps = [
      index?.addresses,
      index?.address,
      index?.contracts,
      index?.routers,
    ].filter(Boolean) as Array<Record<string, any>>;
    for (const m of legacyMaps) {
      const x = m[keyOrAddr];
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && x[chainId]) return x[chainId];
    }
    throw new Error(`Address key "${keyOrAddr}" not found in index.json`);
  }

  let normalizedContractKeyOrAddr = contractFieldRaw;
  if (
    typeof normalizedContractKeyOrAddr === "object" &&
    normalizedContractKeyOrAddr !== null
  ) {
    if ("const" in normalizedContractKeyOrAddr) {
      normalizedContractKeyOrAddr = (normalizedContractKeyOrAddr as any).const;
    } else if (runtimeInputs?.contract) {
      normalizedContractKeyOrAddr = runtimeInputs.contract;
    } else {
      throw new Error(
        `Action schema missing "contract" value (provide at runtime as inputs.contract)`
      );
    }
  }

  const isAddr =
    typeof normalizedContractKeyOrAddr === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(normalizedContractKeyOrAddr);

  const rawAddr = String(
    isAddr
      ? normalizedContractKeyOrAddr
      : resolveRoleOrAddress(String(normalizedContractKeyOrAddr))
  );

  const contractAddr = getAddress(rawAddr.toLowerCase());
  // 4) Params: accept either raw map or JSON-Schema with {properties, required}
  const params =
    paramsSchema &&
      paramsSchema.properties &&
      typeof paramsSchema.properties === "object"
      ? paramsSchema.properties
      : paramsSchema ?? {};

  const required: string[] =
    paramsSchema && Array.isArray(paramsSchema.required)
      ? paramsSchema.required
      : Object.keys(params);

  // 5) Build IO (executor expects io.inputs on the full DSL)
  const ioInputs: Record<string, any> = {};
  for (const [k, ps] of Object.entries<any>(params)) {
    const t = guessTypeFromParamSchema(ps);
    const entry: any = { type: t, required: required.includes(k) };
    if (ps?.description) entry.description = ps.description;
    if (ps?.enum) entry.enum = ps.enum;
    ioInputs[k] = entry;
  }
  if (valueWeiRaw != null) {
    ioInputs["value"] = {
      type: "uint",
      required: false,
      description: "ETH to send in wei",
    };
  }

  // 6) ABI + argument structure inference
  const abiArr = Array.isArray(xAbiRaw)
    ? xAbiRaw
    : [
      `function ${String(xAbiRaw)}`.replace(
        /^function\s+function\s+/,
        "function "
      ),
    ];

  const iface = new Interface(abiArr as any);
  const frag = iface.getFunction(String(methodFieldRaw));

  let structure: "object" | "tuple";
  let arg_object: Record<string, string> | undefined;
  let arg_tuple: string[] | undefined;

  if (frag?.inputs.length === 1 && frag.inputs[0].baseType === "tuple") {
    structure = "object";
    arg_object = buildArgObject(params);
  } else {
    structure = "tuple";
    const abiNames = frag?.inputs.map((i: { name: string | any[] }) =>
      i.name && i.name.length ? i.name : null
    );
    if (abiNames?.every((n: any) => n)) {
      arg_tuple = abiNames.map((n: any) => `{${n!}}`);
    } else {
      const ordered = Array.from(
        new Set([...(required || []), ...Object.keys(params)])
      );
      arg_tuple = ordered.map((k) => `{${k}}`);
    }
  }

  // 7) Build FULL DSL (what the executor expects)
  const dsl: DSL = {
    dsl_version: "0.1",
    protocol: {
      name: String(protocolName),
      version: String(version),
      chainId: chainId,
    },
    action: {
      name: String(methodFieldRaw),
      summary: String(methodFieldRaw),
      category: "action",
      intents: [],
    },
    io: { inputs: ioInputs, outputs: {} },
    defaults: {},
    constraints: {},
    risks: [],
    metadata: { source: "action-adapter" },
    execution: {
      evm: {
        chainId,
        contract: contractAddr,
        method: String(methodFieldRaw),
        structure,
        ...(arg_object ? { arg_object } : {}),
        ...(arg_tuple ? { arg_tuple } : {}),
        abi: abiArr,
        ...(valueWeiRaw != null ? { value: String(valueWeiRaw) } : {}),
      },
    },
  };

  // 8) Validate with the small "envelope" schema, then return the FULL DSL
  const paramsJsonSchema =
    paramsSchema && paramsSchema.properties
      ? paramsSchema
      : { type: "object", properties: params, required };

  const envelope = {
    protocol: String(protocolName),
    chainId,
    contract: contractAddr,
    method: String(methodFieldRaw),
    params: paramsJsonSchema,
    ...(valueWeiRaw != null ? { value: String(valueWeiRaw) } : {}),
    "x-hints": {
      abi: abiArr,
      structure,
      ...(arg_object ? { arg_object } : {}),
      ...(arg_tuple ? { arg_tuple } : {}),
      version: String(version),
    },
  };

  const v2 = validateDSL(envelope as any);
  if (!v2.ok)
    throw new Error("Adapted schema invalid: " + v2.errors.join("; "));

  return dsl;
}
