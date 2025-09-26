// src/intent/schemas.ts
import { z } from "zod";

/**
 * A generic, open-ended Amount spec that callers can provide.
 * Concrete conversion to wei (if needed) can happen later in the pipeline.
 */
export const Amount = z.object({
  kind: z.enum(["wei", "ether", "units", "percent_of_balance"]),
  value: z.union([z.number(), z.string()]),  // allow numbers or numeric strings
  decimals: z.number().int().positive().optional(), // only for kind="units"
});
export type Amount = z.infer<typeof Amount>;

/**
 * The generic Action envelope. No closed unions here — any protocol/action pair is allowed.
 * The accompanying JSON schema under schemas/<protocol>/actions/<action>.json
 * will define/validate the exact params shape.
 */
export const Action = z.object({
  protocol: z.string().min(1),       // e.g. "uniswap_v3", "aave_v3", "lido"
  action: z.string().min(1),         // e.g. "swap", "supply", "wrap"
  // free-form parameters; validated by the action JSON schema, not by this Zod type
  params: z.record(z.any()).default({}),
  // optional hints/overrides
  chainId: z.number().int().positive().optional(),
  id: z.string().optional(),         // optional "<protocol>.<action>" identifier
});
export type Action = z.infer<typeof Action>;

/**
 * A high-level intent containing one or more actions and optional global metadata.
 */
export const ParsedIntent = z.object({
  actions: z.array(Action).min(1),
  meta: z.object({
    chainId: z.number().int().positive().optional(),
    account: z.string().optional(),
    notes: z.string().optional(),
  }).default({}),
});
export type ParsedIntent = z.infer<typeof ParsedIntent>;

/**
 * Helper for runtime validation/convenience in code paths that accept unknowns.
 */
export function parseIntent(input: unknown): ParsedIntent {
  return ParsedIntent.parse(input);
}
