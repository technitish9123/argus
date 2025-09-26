import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import type { AddressRegistry, ChainId } from "../ports.js";
import type { TokenList } from "@uniswap/token-lists";

type Roles = Record<string, string | Record<number, `0x${string}`>>;
type IndexJson = { protocol?: string; name?: string; chainId?: number; roles?: Roles; addresses?: Record<string, string> };

function schemasRootFrom(importMetaUrl: string) {
  const here = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(here, "../../schemas");
}

function indexUrlFor(schemasRoot: string, protocol: string) {
  return pathToFileURL(path.join(schemasRoot, protocol, "index.json")).href;
}

async function importJson<T>(url: string): Promise<T> {
  return (await import(url, { assert: { type: "json" } })).default as T;
}

export function makeSchemaRoleRegistry(schemasRoot = schemasRootFrom(import.meta.url)): Pick<AddressRegistry, "getContract"> {
  const cache = new Map<string, IndexJson>();

  async function load(protocol: string): Promise<IndexJson | null> {
    try {
      if (!cache.has(protocol)) {
        const u = indexUrlFor(schemasRoot, protocol);
        cache.set(protocol, await importJson<IndexJson>(u));
      }
      return cache.get(protocol)!;
    } catch {
      return null;
    }
  }

  return {
    getContract(protocol: string, role: string, chainId: ChainId): `0x${string}` {
      const p = protocol;
      const thrower = () => { throw new Error(`No ${p}.${role} for chain ${chainId}`); };
      const idx = cache.get(p);
      const pick = (val: any): `0x${string}` => {
        if (typeof val === "string") return val as `0x${string}`;
        if (val && typeof val === "object" && val[chainId]) return val[chainId] as `0x${string}`;
        return thrower();
      };
      if (!idx) thrower();
      // prefer roles, but also accept addresses/contracts/routers style
      const roles = (idx as any).roles as Roles | undefined;
      if (roles && role in roles) return pick(roles[role]);
      const maps = [(idx as any).addresses, (idx as any).address, (idx as any).contracts, (idx as any).routers].filter(Boolean);
      for (const m of maps) { if (m[role]) return pick(m[role]); }
      return thrower();
    },
  };
}
