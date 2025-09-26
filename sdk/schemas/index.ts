import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SchemaStore } from "../src/ports";

/** Resolves schemas relative to the package root, not CWD */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_ROOT = path.resolve(HERE, "../../schemas");

export const localSchemaStore: SchemaStore = {
  async getActionSchema(protocol: string, action: string, _version?: string) {
    const p = path.join(SCHEMAS_ROOT, protocol, "actions", `${action}.json`);
    const url = pathToFileURL(p).href;
    const mod = await import(url, { assert: { type: "json" } } as any);
    return (mod.default ?? mod) as any;
  },
};
