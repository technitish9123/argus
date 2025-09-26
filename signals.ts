// ========================
// Types
// ========================
export type TriSignal = -1 | 0 | 1;

export interface OHLCV {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume?: number[];
}

export type SignalFn = (series: number[] | OHLCV) => TriSignal[];

export interface PositionContext {
    price: number;         // current price
    equity: number;        // account equity
    series?: OHLCV;        // for ATR sizing
    signal: TriSignal;     // -1 | 0 | +1
    time?: number;         // timestamp
    currentUnits?: number; // position size
    maxLeverage?: number;  // optional cap
}

export type PositionSizer = (ctx: PositionContext) => number; // TARGET units

// ========================
// Math / Indicators
// ========================
export function sma(x: number[], len: number): number[] {
    const out = new Array(x.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
        sum += x[i];
        if (i >= len) sum -= x[i - len];
        if (i >= len - 1) out[i] = sum / len;
    }
    return out;
}

export function ema(x: number[], len: number): number[] {
    const out = new Array(x.length).fill(NaN);
    const k = 2 / (len + 1);
    let prev = x[0];
    out[0] = prev;
    for (let i = 1; i < x.length; i++) {
        const v = x[i] * k + prev * (1 - k);
        out[i] = v;
        prev = v;
    }
    return out;
}

export function rsi(close: number[], len = 14): number[] {
    const out = new Array(close.length).fill(NaN);
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i < close.length; i++) {
        const ch = close[i] - close[i - 1];
        const gain = Math.max(ch, 0);
        const loss = Math.max(-ch, 0);
        if (i <= len) {
            avgGain += gain; avgLoss += loss;
            if (i === len) {
                avgGain /= len; avgLoss /= len;
                const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
                out[i] = 100 - 100 / (1 + rs);
            }
        } else {
            avgGain = (avgGain * (len - 1) + gain) / len;
            avgLoss = (avgLoss * (len - 1) + loss) / len;
            const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
            out[i] = 100 - 100 / (1 + rs);
        }
    }
    return out;
}

export function macd(close: number[], fast = 12, slow = 26, signal = 9) {
    const emaFast = ema(close, fast);
    const emaSlow = ema(close, slow);
    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const signalLine = ema(macdLine.map(v => (isFinite(v) ? v : 0)), signal);
    const hist = macdLine.map((v, i) => v - signalLine[i]);
    return { macdLine, signalLine, hist };
}

export function trueRange(h: number[], l: number[], c: number[]): number[] {
    const out = new Array(c.length).fill(NaN);
    for (let i = 0; i < c.length; i++) {
        if (i === 0) out[i] = h[i] - l[i];
        else out[i] = Math.max(
            h[i] - l[i],
            Math.abs(h[i] - c[i - 1]),
            Math.abs(l[i] - c[i - 1])
        );
    }
    return out;
}

export function atr(h: number[], l: number[], c: number[], len = 14): number[] {
    return ema(trueRange(h, l, c), len);
}

// ========================
// Signal Generators
// ========================

/** Moving Average Crossover */
export const crossOverSignal = (opts: { fast: number; slow: number }): SignalFn => {
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const f = sma(close, opts.fast);
        const s = sma(close, opts.slow);
        return close.map((_, i) => {
            if (!isFinite(f[i]) || !isFinite(s[i])) return 0;
            if (f[i] > s[i]) return 1;
            if (f[i] < s[i]) return -1;
            return 0;
        });
    };
};

/** RSI Thresholds */
export const rsiSignal = (opts: { len?: number; overbought?: number; oversold?: number } = {}): SignalFn => {
    const { len = 14, overbought = 70, oversold = 30 } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const r = rsi(close, len);
        return r.map(v => !isFinite(v) ? 0 : (v < oversold ? 1 : v > overbought ? -1 : 0));
    };
};

/** MACD Cross */
export const macdSignal = (opts: { fast?: number; slow?: number; signal?: number } = {}): SignalFn => {
    const { fast = 12, slow = 26, signal: sig = 9 } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const { macdLine, signalLine } = macd(close, fast, slow, sig);
        return macdLine.map((v, i) => {
            if (!isFinite(v) || !isFinite(signalLine[i])) return 0;
            if (v > signalLine[i]) return 1;
            if (v < signalLine[i]) return -1;
            return 0;
        });
    };
};

/** Breakout (Donchian Channel) */
export const breakoutSignal = (opts: { lookback: number }): SignalFn => {
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const out: TriSignal[] = new Array(close.length).fill(0);
        for (let i = 0; i < close.length; i++) {
            if (i < opts.lookback) continue;
            const hi = Math.max(...close.slice(i - opts.lookback, i));
            const lo = Math.min(...close.slice(i - opts.lookback, i));
            out[i] = close[i] > hi ? 1 : close[i] < lo ? -1 : 0;
        }
        return out;
    };
};

/** Mean Reversion (z-score vs SMA) */
export const meanRevSignal = (opts: { len: number; zEntry: number }): SignalFn => {
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const m = sma(close, opts.len);
        const out: TriSignal[] = new Array(close.length).fill(0);
        for (let i = opts.len; i < close.length; i++) {
            const window = close.slice(i - opts.len + 1, i + 1);
            const mean = window.reduce((a, b) => a + b, 0) / opts.len;
            const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / opts.len;
            const sd = Math.sqrt(variance);
            const z = sd === 0 ? 0 : (close[i] - mean) / sd;
            out[i] = z <= -opts.zEntry ? 1 : z >= opts.zEntry ? -1 : 0;
        }
        return out;
    };
};

/** Ensemble (majority vote across signals) */
export const ensemble = (signals: SignalFn[]): SignalFn => {
    return (series: number[] | OHLCV): TriSignal[] => {
        const outs = signals.map(fn => fn(series));
        const n = Array.isArray(series) ? series.length : series.close.length;
        return Array.from({ length: n }, (_, i) => {
            const score = outs.reduce((acc, arr) => acc + (arr[i] ?? 0), 0);
            return score > 0 ? 1 : score < 0 ? -1 : 0;
        });
    };
};
