// src/llm/ollama.ts
import type { ParsedIntent } from "../src/intent/schemas.js";

// Light shape guard
function coerceParsedIntent(json: any): ParsedIntent {
  if (!json || typeof json !== "object") throw new Error("Planner returned no JSON");
  if (!Array.isArray(json.actions)) throw new Error("Planner JSON missing actions[]");
  if (!json.meta || typeof json.meta !== "object") json.meta = {};
  return json as ParsedIntent;
}

function extractFirstJsonBlock(s: string): any {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  throw new Error("Failed to parse planner JSON");
}

export type OllamaPlannerOptions = {
  baseUrl?: string;           // default http://127.0.0.1:11434
  model?: string;             // e.g. "llama3.1:8b"
  temperature?: number;       // default 0.2
  chainIdDefault?: number;    // default 1
  extraSystemPreamble?: string;
};

const DEFAULT_SYSTEM = `
You convert a user's DeFi instruction into a JSON plan (ParsedIntent). Reply with JSON ONLY.

Types:
type Amount =
  | { kind: "wei"; value: string | number }
  | { kind: "ether"; value: string | number }
  | { kind: "units"; value: string | number; decimals?: number }
  | { kind: "percent_of_balance"; value: number };

type Action = {
  protocol: string;
  action: string;         // MUST be canonical for this repo (e.g., lido.submit, NOT lido.stake; aave.supply)
  params: Record<string, any>;
  chainId?: number;
  // NEW (optional but preferred): fully-specified tx plan for signature-based execution
  meta?: {
    txPlan?: {
      signature: string;                // e.g. "function submit(address referral) payable returns (uint256)"
      targetRole?: string;              // e.g. "steth", "wsteth", "pool"
      to?: string;                      // e.g. "0x..." if known; else engine resolves targetRole via registry
      argsByName: Record<string, any>;  // keys MUST match signature param names exactly
      valueWei?: string;                // hex or decimal string; omit if non-payable
    }
  };
};

type ParsedIntent = { actions: Action[]; meta: { chainId?: number } };

Rules:
- Use chainId = 1 unless user specifies otherwise.
- Canonical actions:
  - Lido stake => { protocol:"lido", action:"submit" }
  - Lido wrap stETH => { protocol:"lido", action:"wrap", params:{ assetSymbol:"STETH", amount:Amount } }
  - Aave supply => { protocol:"aave", action:"supply", params:{ assetSymbol:string, amount:Amount, useAsCollateral?: boolean, onBehalfOf?: string } }
- ALWAYS emit meta.txPlan with a correct Solidity function signature and argsByName that match the signature.
- For Lido submit, include referral (zero address if none provided) and set valueWei to the ETH amount.
- Prefer roles over addresses (set targetRole, not to).
- If approvals are required, include explicit ERC20 approve actions BEFORE the dependent action (engine will not auto-insert).
- If unsure, return { "actions": [], "meta": {} }.
`.trim();

export default class OllamaPlanner {
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private chainIdDefault: number;
  private system: string;

  constructor(opts: OllamaPlannerOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
    this.model = opts.model ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b";
    this.temperature = opts.temperature ?? 0.2;
    this.chainIdDefault = opts.chainIdDefault ?? 1;
    this.system = (opts.extraSystemPreamble ? `${DEFAULT_SYSTEM}\n\n${opts.extraSystemPreamble}` : DEFAULT_SYSTEM);
  }

  async plan(prompt: string): Promise<ParsedIntent> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: this.system },
          {
            role: "user",
            content:
              `User instruction:\n${prompt}\n\n` +
              `Return ONLY minified JSON for ParsedIntent. Include meta.chainId=${this.chainIdDefault} unless specified.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${t}`);
    }

    const payload = await res.json();
    const content: string = payload?.message?.content ?? payload?.response ?? "";
    if (!content) throw new Error("Empty response from Ollama");

    let obj: any;
    try { obj = JSON.parse(content); } catch { obj = extractFirstJsonBlock(content); }

    if (obj && !obj.meta) obj.meta = {};
    if (obj?.meta?.chainId == null) obj.meta.chainId = this.chainIdDefault;
    if (Array.isArray(obj?.actions)) {
      for (const a of obj.actions) if (a.chainId == null) a.chainId = this.chainIdDefault;
    }

    return coerceParsedIntent(obj);
  }
}
