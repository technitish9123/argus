import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
/** Resolves schemas relative to the package root, not CWD */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_ROOT = path.resolve(HERE, "../../schemas");
export const localSchemaStore = {
    async getActionSchema(protocol, action, _version) {
        const p = path.join(SCHEMAS_ROOT, protocol, "actions", `${action}.json`);
        const url = pathToFileURL(p).href;
        const mod = await import(url, { assert: { type: "json" } });
        return (mod.default ?? mod);
    },
};
//# sourceMappingURL=index.js.map