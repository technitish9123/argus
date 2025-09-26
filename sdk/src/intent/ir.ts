// src/intent/ir.ts
import { z } from "zod";
import { Action } from "./schemas.js"

// Control-flow aware IR
export const IRStep = z.object({ kind: z.literal("action"), action: z.custom<Action>() });

export const IRLoop = z.object({
  kind: z.literal("loop"),
  // either fixed loops or guard (keep it simple: support one; you can extend later)
  times: z.number().int().positive().optional(),
  // Optional guard shape to extend later (hf/ltv targets)
  until: z
    .object({
      targetLtvBps: z.number().int().min(1).max(9999).optional(),
      minHealthFactor: z.number().min(1).max(5).optional(),
      maxLoops: z.number().int().positive().default(10).optional(),
    })
    .partial()
    .optional(),
  steps: z.array(z.lazy(() => IRNode)),
});

export const IRSeq  = z.object({ kind: z.literal("seq"), steps: z.array(z.lazy(() => IRNode)) });

export const IRNode: z.ZodType<any> = z.union([IRStep, IRLoop, IRSeq]);

export const ParsedPlan = z.object({
  plan: z.array(IRNode),
  meta: z
    .object({
      chainId: z.number().int().positive().optional(),
      account: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      notes: z.string().optional(),
    })
    .default({}),
});

export type IRNode = z.infer<typeof IRNode>;
export type ParsedPlan = z.infer<typeof ParsedPlan>;
