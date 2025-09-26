import type { DSL } from "../core/types.js";
import { getAddress } from "ethers";

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function applyDefaultsAndTemplates(dsl: DSL, inputs: Record<string, any>, caller: string) {
  const out: Record<string, any> = { ...inputs };
  const defs = dsl.defaults ?? {};
  for (const [k, v] of Object.entries(defs)) {
    if (out[k] !== undefined && out[k] !== null) continue;
    out[k] = materializeTemplate(v, caller);
  }
  for (const [k, spec] of Object.entries(dsl.io.inputs)) {
    const s: any = spec;
    if (out[k] == null && s.default != null) out[k] = materializeTemplate(s.default, caller);
    if (s.required !== false && out[k] == null) throw new Error(`Missing required input: ${k}`);
  }
  return out;
}


export function materializeTemplate(v: any, caller: string) {
  if (typeof v === "string") {
    if (v === "{caller}") return caller;
    if (v.startsWith("{env:") && v.endsWith("}")) {
      const key = v.slice(5, -1);
      const val = process.env[key];
      if (val == null) throw new Error(`Missing env var ${key}`);
      return val;
    }
    if (v.startsWith("{now}")) {
      const rest = v.slice("{now}".length);
      const m = rest.match(/^([+-])(\d+)(s)?$/);
      if (m) {
        const delta = parseInt(m[2], 10) * (m[1] === "+" ? 1 : -1);
        return Math.floor(Date.now() / 1000) + delta;
      }
      return Math.floor(Date.now() / 1000);
    }
  }
  return v;
}
export function enforceConstraints(
  dsl: DSL,
  inputs: Record<string, any>,
  caller?: string
) {
  const c: any = dsl.constraints ?? {};
  if (c.token_whitelist && Array.isArray(c.token_whitelist)) {
    const wl = c.token_whitelist.map((t: any) => (t.address as string).toLowerCase());
    if (inputs.token_in && !wl.includes((inputs.token_in as string).toLowerCase())) {
      throw new Error(`token_in not in whitelist`);
    }
    if (inputs.token_out && !wl.includes((inputs.token_out as string).toLowerCase())) {
      throw new Error(`token_out not in whitelist`);
    }
  }
  if (inputs.slippage_bps != null) {
    const s = Number(inputs.slippage_bps);
    if (isNaN(s) || s < 0 || s > 5000) throw new Error(`slippage_bps out of range`);
  }
  if (c.numeric_ranges) {
    for (const [k, r] of Object.entries<any>(c.numeric_ranges)) {
      if (inputs[k] != null) {
        const val = Number(inputs[k]);
        if (r.min != null && val < r.min) throw new Error(`${k} below minimum`);
        if (r.max != null && val > r.max) throw new Error(`${k} above maximum`);
      }
    }
  }
  if (c.allowed_addresses) {
    for (const [k, list] of Object.entries<any>(c.allowed_addresses)) {
      if (
        inputs[k] &&
        !list
          .map((a: string) => a.toLowerCase())
          .includes(String(inputs[k]).toLowerCase())
      ) {
        throw new Error(`${k} not in allowed addresses`);
      }
    }
  }
  if (c.allowed_callers && Array.isArray(c.allowed_callers)) {
    const allowed = c.allowed_callers.map((a: string) => a.toLowerCase());
    if (!caller || !allowed.includes(caller.toLowerCase())) {
      throw new Error(`caller not allowed`);
    }
  }
  for (const [k, spec] of Object.entries(dsl.io.inputs)) {
    const s: any = spec;
    if (inputs[k] != null) {
      const val = Number(inputs[k]);
      if (s.min != null && val < s.min) throw new Error(`${k} below minimum`);
      if (s.max != null && val > s.max) throw new Error(`${k} above maximum`);
      if (s.enum && Array.isArray(s.enum)) {
        const list = s.enum.map((x: any) => String(x));
        if (!list.includes(String(inputs[k]))) {
          throw new Error(`${k} not in enum`);
        }
      }
    }
  }
}

export function normalizeAddressInputs(dsl: DSL, inputs: Record<string, any>) {
  for (const [k, spec] of Object.entries(dsl.io.inputs)) {
    const t = (spec as any)?.type;
    if ((t === "address" || t === "token") && inputs[k]) {
      inputs[k] = getAddress(String(inputs[k])); // throws if invalid
    }
  }
  return inputs;
}