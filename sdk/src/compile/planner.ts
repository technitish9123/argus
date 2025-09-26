import type { IRNode, ParsedPlan } from "../intent/ir.js";
import { planFromAction, PlanStep } from "./router.js";

export type BuildPlanOpts = {
  chainIdDefault?: number;
  account?: `0x${string}`;
  getBalanceWei?: (tokenAddress: `0x${string}`) => Promise<bigint>;
  registry?: import("../ports.js").AddressRegistry;
};

export async function buildPlan(
  plan: ParsedPlan,
  opts: BuildPlanOpts
): Promise<PlanStep[]> {
  const out: PlanStep[] = [];
  async function walk(n: IRNode): Promise<void> {
    if (n.kind === "action") {
      const steps = await planFromAction(n.action as any, opts);
      out.push(...steps);
      return;
    }
    if (n.kind === "seq") {
      for (const s of n.steps) await walk(s);
      return;
    }
    if (n.kind === "loop") {
      const loops = n.times ?? n.until?.maxLoops ?? 1;
      for (let i = 0; i < loops; i++) {
        for (const s of n.steps) await walk(s);
        // (Optional) early-exit if you implement guards like HF/LTV checks
      }
      return;
    }
  }
  for (const n of plan.plan) await walk(n);
  return out;
}
