// src/core/validator.ts
import Ajv from "ajv";
import addFormats from "ajv-formats";

// Envelope (action-instance) schema
import envelopeSchema from "../../spec/dsl.schema.json" with { type: "json" };
// IMPORTANT: declares $id: "ank://schemas/_common/common.schema.json"
import commonDefs from "../../schemas/_common/action.schema.json" with { type: "json" };

// We intentionally do NOT import the full-DSL JSON schema here.
// The validator below accepts full DSL docs pass-through and validates envelopes via Ajv.

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);

// Register common $defs so ank://... $refs resolve (e.g., RoleOrAddress, AmountWei)
ajv.addSchema(commonDefs as any); // uses the schema's own $id

const validateEnvelopeFn = ajv.compile(envelopeSchema as any);

// Narrowing helper: detect a FULL DSL document (v0.1-style) vs an envelope
export function isFullDSLDocument(doc: any): doc is {
  dsl_version: string;
  protocol: { name: string; version: string; chainId: number };
  execution: any;
} {
  return !!(
    doc &&
    typeof doc === "object" &&
    "dsl_version" in doc &&
    "execution" in doc
  );
}

/**
 * validateDSL:
 * - If given a FULL DSL document, returns it as-is (executor expects this shape).
 * - Otherwise, treats input as an "action envelope" and validates it against spec/dsl.schema.json.
 */
export function validateDSL(
  doc: unknown
): { ok: true; doc: any } | { ok: false; errors: string[] } {
  if (isFullDSLDocument(doc)) {
    return { ok: true, doc: doc as any };
  }
  const valid = validateEnvelopeFn(doc);
  if (!valid) {
    const errors = (validateEnvelopeFn.errors ?? []).map(
      (e) => `${e.instancePath || "(root)"} ${e.message}`
    );
    return { ok: false, errors };
  }
  return { ok: true, doc: doc as any };
}
