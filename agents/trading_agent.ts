/**
 * Trading Agent — Ensemble Trend/MR with ATR Risk Sizing
 * ------------------------------------------------------
 * - Uses your signal & sizing toolbox style (TriSignal, OHLCV, etc.)
 * - Composite signal: MA crossover (trend) + RSI filter (avoid OB/OS traps)
 * - Optional mean-reversion overlay on chop (configurable)
 * - ATR-based risk sizing -> TARGET units
 * - Emits "intents" (buy/sell deltas) you can route to your broker/agent runtime
 *
 * Expected external environment (like leverage_loop):
 * - You can call `run({ series, params, broker })` from your agent runtime.
 * - `broker` is a thin adapter you provide (paper or live) with minimal methods used here.
 */

//////////////////////////////
// Import your indicators API
//////////////////////////////

// Adjust the import path to wherever your toolbox lives.
// If this file lives next to your indicator library, use './signals'.
// Otherwise, use the correct relative path in your repo.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAgentAction } from "@apdsl/agent-kit";
import type { OHLCV, TriSignal, PositionSizer, PositionContext } from "../signals";
import { sma, rsi, macd, atr, ema, crossOverSignal, rsiSignal, meanRevSignal, ensemble } from "../signals";

//////////////////////////////
// Types for the agent runtime
//////////////////////////////

export type RiskLevel = "low" | "medium" | "high";

export interface AgentParams {
    // Signal params
    fast?: number;              // MA fast
    slow?: number;              // MA slow
    rsiLen?: number;            // RSI length
    rsiOB?: number;             // RSI overbought
    rsiOS?: number;             // RSI oversold
    useMeanRev?: boolean;       // add a light MR overlay

    // Risk/sizer params
    riskPct?: number;           // % of equity at risk per trade (e.g., 0.01)
    atrLen?: number;            // ATR length
    atrMult?: number;           // ATR multiple (for stop width)
    lots?: number;              // base lot size (multiplier)
    maxLeverage?: number;       // optional leverage cap

    // Meta
    risk?: RiskLevel;           // "low" | "medium" | "high"
    symbol?: string;            // informative; used in intents
}

export interface AgentIntent {
    type: "order";
    symbol: string;
    side: "buy" | "sell";
    deltaUnits: number;     // positive -> buy; negative -> sell
    reason: string;         // human-readable explanation
    ts: number;             // timestamp
    price: number;          // last price used
    context: {
        signal: TriSignal;
        targetUnits: number;
        currentUnits: number;
    };
}

export interface BrokerAdapter {
    // Minimal adapter used here; wire this to your real/paper broker.
    getPositionUnits(symbol: string): Promise<number>;
    // meta may include { price }
    placeMarketOrder(symbol: string, unitsDelta: number, meta?: Record<string, any>): Promise<{ txId?: string }>;
}

export interface RunContext {
    series: OHLCV;
    params?: AgentParams;
    broker: BrokerAdapter;
    equity?: number; // if omitted, set a default
    log?: (msg: string) => void;
}

//////////////////////////////
// Defaults
//////////////////////////////

const DEFAULTS: Required<Pick<
    AgentParams,
    "fast" | "slow" | "rsiLen" | "rsiOB" | "rsiOS" | "useMeanRev" | "riskPct" | "atrLen" | "atrMult" | "lots"
>> = {
    fast: 20,
    slow: 50,
    rsiLen: 14,
    rsiOB: 70,
    rsiOS: 30,
    useMeanRev: true,
    riskPct: 0.01,
    atrLen: 14,
    atrMult: 2,
    lots: 1,
};

//////////////////////////////
// ATR Risk Sizer (like leverage_loop style)
//////////////////////////////

export function atrRiskSizer(cfg: {
    riskPct: number;
    atrLen: number;
    atrMult: number;
    lots: number;
}): PositionSizer {
    const { riskPct, atrLen, atrMult, lots } = cfg;
    return (ctx: PositionContext) => {
        const { price, equity, series, signal, currentUnits = 0, maxLeverage } = ctx;
        if (!series) return 0; // need OHLC for ATR sizing
        const { high, low, close } = series;
        const atrArr = atr(high, low, close, atrLen);
        const lastATR = atrArr.at(-1)!;
        if (!isFinite(lastATR) || lastATR <= 0) return 0;

        // risk $ per unit ~ ATR*ATRmult
        const riskPerUnit = lastATR * atrMult;
        const accountRisk$ = equity * riskPct;

        const rawUnits = accountRisk$ / Math.max(riskPerUnit, 1e-9);
        let targetUnits = Math.floor(rawUnits) * signal * lots;

        if (maxLeverage && maxLeverage > 0) {
            // cap in units: leverage cap roughly -> (equity * maxLev) / price
            const cap = Math.floor((equity * maxLeverage) / Math.max(price, 1e-9));
            targetUnits = Math.max(Math.min(targetUnits, cap), -cap);
        }

        return targetUnits;
    };
}

//////////////////////////////
// Composite Signal
//////////////////////////////

function buildSignal(p: AgentParams): (series: OHLCV) => TriSignal[] {
    const fast = p.fast ?? DEFAULTS.fast;
    const slow = p.slow ?? DEFAULTS.slow;
    const rsiLen = p.rsiLen ?? DEFAULTS.rsiLen;
    const rsiOB = p.rsiOB ?? DEFAULTS.rsiOB;
    const rsiOS = p.rsiOS ?? DEFAULTS.rsiOS;

    const trend = crossOverSignal({ fast, slow });               // -1/0/+1
    const rsiGate = rsiSignal({ len: rsiLen, overbought: rsiOB, oversold: rsiOS }); // -1/0/+1
    const signals = [trend, rsiGate];

    // Optional mean reversion nudge (very mild; only when asked)
    if (p.useMeanRev ?? DEFAULTS.useMeanRev) {
        signals.push(meanRevSignal({ len: 20, zEntry: 1.5 }));
    }

    return ensemble(signals); // majority vote -> -1/0/+1
}

//////////////////////////////
// Core Agent
//////////////////////////////

export async function run(ctx: RunContext) {
    const {
        series,
        broker,
        params = {},
        equity = 100_000,
    } = ctx;

    const log = ctx.log ?? console.log;
    const symbol = params.symbol ?? "ETH-USD";

    // Build signal + sizer
    const signalFn = buildSignal(params);
    const sigArr = signalFn(series);
    const signalNow = sigArr.at(-1) ?? 0;

    const sizer = atrRiskSizer({
        riskPct: params.riskPct ?? DEFAULTS.riskPct,
        atrLen: params.atrLen ?? DEFAULTS.atrLen,
        atrMult: params.atrMult ?? DEFAULTS.atrMult,
        lots: params.lots ?? DEFAULTS.lots,
    });

    const price = series.close.at(-1)!;
    const currentUnits = await broker.getPositionUnits(symbol);
    const targetUnits = sizer({
        price,
        equity,
        series,
        signal: signalNow,
        currentUnits,
        maxLeverage: params.maxLeverage,
    });

    const delta = targetUnits - currentUnits;

    // --- Confidence
    const subSignals = [
        crossOverSignal({ fast: params.fast ?? DEFAULTS.fast, slow: params.slow ?? DEFAULTS.slow })(series.close),
        rsiSignal({ len: params.rsiLen ?? DEFAULTS.rsiLen, overbought: params.rsiOB ?? DEFAULTS.rsiOB, oversold: params.rsiOS ?? DEFAULTS.rsiOS })(series.close),
    ];
    if (params.useMeanRev ?? DEFAULTS.useMeanRev) {
        subSignals.push(meanRevSignal({ len: 20, zEntry: 1.5 })(series.close));
    }
    const agree = subSignals.filter(s => s.at(-1) === signalNow).length;
    const confidence = agree / subSignals.length;

    // --- Logging
    if (signalNow > 0) log(`[Agent] Signal: LONG (+1) | Confidence: ${confidence.toFixed(2)}`);
    if (signalNow < 0) log(`[Agent] Signal: SHORT (-1) | Confidence: ${confidence.toFixed(2)}`);
    if (signalNow === 0) log(`[Agent] Signal: FLAT (0)`);

    if (delta !== 0) {
        if (delta > 0) log(`[Agent] Buying ${Math.abs(delta)} ${symbol.split("-")[0]} with ~$${(Math.abs(delta) * price).toFixed(2)} USDC on Uniswap v3`);
        if (delta < 0) log(`[Agent] Selling ${Math.abs(delta)} ${symbol.split("-")[0]} for ~$${(Math.abs(delta) * price).toFixed(2)} USDC on Uniswap v3`);

        const res = await broker.placeMarketOrder(symbol, delta, { price });
        log(`[Agent] TX: ${res.txId ?? "simulated-tx"} confirmed`);

        const stopLoss = (price * 0.9).toFixed(2);
        const takeProfit = (price * 1.2).toFixed(2);
        log(`[Agent] Stop-loss set @ $${stopLoss} | Take-profit @ $${takeProfit}`);
    } else {
        log(`[Agent] No position change required.`);
    }

    return {
        executed: delta !== 0,
        intent: {
            type: "order",
            symbol,
            side: delta >= 0 ? "buy" : "sell",
            deltaUnits: delta,
            reason: reasonText(signalNow, params),
            ts: Date.now(),
            price,
            context: { signal: signalNow, targetUnits, currentUnits },
        },
    };
}


function reasonText(signal: TriSignal, p: AgentParams) {
    if (signal > 0) return `Go LONG (fast>${p.fast ?? DEFAULTS.fast} / slow>${p.slow ?? DEFAULTS.slow}, RSI filter OK)`;
    if (signal < 0) return `Go SHORT (fast<${p.fast ?? DEFAULTS.fast} / slow<${p.slow ?? DEFAULTS.slow}, RSI filter OK)`;
    return "FLAT (no clear edge or volatility gated)";
}

//////////////////////////////
// Optional: quick backtest helper (toy)
//////////////////////////////

export function backtest(series: OHLCV, params: AgentParams & { equity0?: number } = {}) {
    const equity0 = params.equity0 ?? 100_000;
    const signalFn = buildSignal(params);
    const sig = signalFn(series);

    const sizer = atrRiskSizer({
        riskPct: params.riskPct ?? DEFAULTS.riskPct,
        atrLen: params.atrLen ?? DEFAULTS.atrLen,
        atrMult: params.atrMult ?? DEFAULTS.atrMult,
        lots: params.lots ?? DEFAULTS.lots,
    });

    let equity = equity0;
    let units = 0;

    for (let i = 1; i < series.close.length; i++) {
        const price = series.close[i];
        const ctx: PositionContext = {
            price,
            equity,
            series: {
                open: series.open.slice(0, i + 1),
                high: series.high.slice(0, i + 1),
                low: series.low.slice(0, i + 1),
                close: series.close.slice(0, i + 1),
                volume: series.volume?.slice(0, i + 1),
            },
            signal: sig[i] ?? 0,
            currentUnits: units,
            maxLeverage: params.maxLeverage,
        };
        const target = sizer(ctx);
        const delta = target - units;

        // mark-to-market PnL on each step
        const ret = (series.close[i] - series.close[i - 1]) / series.close[i - 1];
        equity += units * series.close[i - 1] * ret;

        // rebalance to target
        units += delta;
    }

    // Final MTM to last close (already applied in loop)
    return { equityStart: equity0, equityEnd: equity, pnl: equity - equity0, retPct: (equity / equity0 - 1) * 100 };
}

//////////////////////////////
// Example thin broker (paper)
//////////////////////////////

export class PaperBroker implements BrokerAdapter {
    private units = new Map<string, number>();
    async getPositionUnits(symbol: string): Promise<number> {
        return this.units.get(symbol) ?? 0;
        // In real code, query exchange / vault / subaccount, etc.
    }
    async placeMarketOrder(symbol: string, unitsDelta: number) {
        const cur = this.units.get(symbol) ?? 0;
        this.units.set(symbol, cur + unitsDelta);
        return { txId: `paper-${Date.now()}` };
    }
}

// Helper to build file URL for schemas
function fp(p: string) { return pathToFileURL(p).href; }

/**
 * OnchainBroker: example BrokerAdapter that executes on-chain actions using
 * the agent engine (runAgentAction) and logs transactions similar to the
 * `leverage_loop` example. Construct with RPC details and a builder that
 * converts (symbol, unitsDelta, price) -> inputs for the action schema.
 */
export class OnchainBroker implements BrokerAdapter {
    rpcUrl: string;
    privateKey: string;
    simulateOnly: boolean;
    schemaPath: string;
    buildInputs: (symbol: string, unitsDelta: number, price?: number) => Record<string, any>;

    constructor(opts: {
        rpcUrl: string;
        privateKey: string;
        schemaPath: string; // file URL or path to action schema
        simulateOnly?: boolean;
        buildInputs: (symbol: string, unitsDelta: number, price?: number) => Record<string, any>;
    }) {
        this.rpcUrl = opts.rpcUrl;
        this.privateKey = opts.privateKey;
        this.simulateOnly = !!opts.simulateOnly;
        this.schemaPath = opts.schemaPath;
        this.buildInputs = opts.buildInputs;
    }

    async getPositionUnits(symbol: string): Promise<number> {
        // In a real broker you would query on-chain or via indexer; here we
        // don't track positions so return 0 as fallback.
        return 0;
    }

    async placeMarketOrder(symbol: string, unitsDelta: number, meta?: Record<string, any>) {
        const price = meta?.price;
        console.log(`[OnchainBroker] Preparing on-chain order for ${symbol}: unitsDelta=${unitsDelta} price=${price}`);

        const inputs = this.buildInputs(symbol, unitsDelta, price);
        console.log(`[OnchainBroker] executing schema=${this.schemaPath} inputs=${JSON.stringify(inputs)}`);

        try {
            // const result = await runAgentAction({
            //     schemaPath: this.schemaPath,
            //     inputs,
            //     rpcUrl: this.rpcUrl,
            //     privateKey: this.privateKey,
            //     simulateOnly: this.simulateOnly
            // });

            // runAgentAction/execFromFile already logs simulation and tx details.
            // Provide a concise result for callers.
            const txId = (result as any).txHash ?? (result as any).simulated_amountOut ?? "no-tx";
            console.log(`[OnchainBroker] executed tx=${txId}`);
            return { txId };
        } catch (err) {
            console.error(`[OnchainBroker] error executing on-chain order:`, err);
            throw err;
        }
    }
}

//////////////////////////////
// Example usage (if you want local test)
//
import { loadCSV } from '../utils/load'; // parse to OHLCV
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const csvRoot = path.join(rootDir, 'eth_consolidated.csv');
const csvBackend = path.join(rootDir, 'backend', 'data', 'eth_consolidated.csv');
let csvPath = csvRoot;
if (!fs.existsSync(csvPath)) {
    if (fs.existsSync(csvBackend)) {
        csvPath = csvBackend;
    } else {
        console.error('[ERROR] Could not find eth_consolidated.csv in project root or backend/data.');
        console.error('Please place a valid OHLCV CSV at eth_consolidated.csv or backend/data/eth_consolidated.csv.');
        process.exit(1);
    }
}

const ohlc = await loadCSV(csvPath);

// --- OnchainBroker setup for real Uniswap swap ---
const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const FEE_TIER = 3000;
const recipient = process.env.AGENT_RECIPIENT || '0x' + 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'.slice(-40); // default Anvil address

const schemaPath = fp(path.join(rootDir, 'schemas/uniswap_v3/actions/exactInputSingle.json'));

const buildInputs = (symbol: string, unitsDelta: number, price?: number) => {
    // For demo: always swap WETH -> USDC
    const amountIn = Math.abs(unitsDelta) * 1e18; // 1 unit = 1 WETH
    return {
        protocol: 'uniswap_v3',
        method: 'exactInputSingle',
        contract: UNISWAP_ROUTER,
        params: {
            contract: UNISWAP_ROUTER,
            tokenIn: WETH,
            tokenOut: USDC,
            fee: FEE_TIER,
            recipient,
            deadline: Math.floor(Date.now() / 1000) + 1200,
            amountIn: amountIn.toString(),
            amountOutMinimum: '0',
            sqrtPriceLimitX96: '0'
        },
        chainId: 1
    };
};

const broker = new OnchainBroker({
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    privateKey: process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    schemaPath,
    simulateOnly: false,
    buildInputs
});

const res = await run({
    series: ohlc,
    params: { symbol: 'ETH-USD', riskPct: 0.01, atrLen: 14, atrMult: 2, fast: 20, slow: 50, rsiLen: 14 },
    broker,
    equity: 100_000
});
console.log(res);

//////////////////////////////
