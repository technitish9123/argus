

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
    price: number;        // current price
    equity: number;       // current account equity
    series?: OHLCV;       // (optional) for ATR/vol sizing
    signal: TriSignal;    // -1 | 0 | +1
    time?: number;        // optional timestamp
    currentUnits?: number;// current position size (units)
    maxLeverage?: number; // optional leverage cap
}

export type PositionSizer = (ctx: PositionContext) => number; // returns TARGET units (+/-)

// ========================
// Math / Indicators
// ========================
export function sma(x: number[], len: number): number[] {
    const out: number[] = new Array(x.length).fill(NaN);
    let s = 0;
    for (let i = 0; i < x.length; i++) {
        s += x[i];
        if (i >= len) s -= x[i - len];
        if (i >= len - 1) out[i] = s / len;
    }
    return out;
}

export function ema(x: number[], len: number): number[] {
    const out: number[] = new Array(x.length).fill(NaN);
    const k = 2 / (len + 1);
    let prev = x[0];
    out[0] = prev;
    for (let i = 1; i < x.length; i++) {
        const v = out[i] = x[i] * k + prev * (1 - k);
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
    const tr = trueRange(h, l, c);
    return ema(tr, len);
}

// ========================
// Signal Library (each returns TriSignal[])
// ========================

/** Moving Average Crossover */
export const crossOverSignal = (opts: { fast: number; slow: number }) => {
    const { fast, slow } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const f = sma(close, fast);
        const s = sma(close, slow);
        return close.map((_, i) => {
            if (!isFinite(f[i]) || !isFinite(s[i])) return 0;
            if (f[i] > s[i]) return 1;
            if (f[i] < s[i]) return -1;
            return 0;
        });
    };
};

/** RSI Thresholds */
export const rsiSignal = (opts: { len?: number; overbought?: number; oversold?: number } = {}) => {
    const { len = 14, overbought = 70, oversold = 30 } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const r = rsi(close, len);
        return r.map(v => !isFinite(v) ? 0 : (v < oversold ? 1 : v > overbought ? -1 : 0));
    };
};

/** MACD Trend */
export const macdSignal = (opts: { fast?: number; slow?: number; signal?: number } = {}) => {
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

/** Breakout (Donchian) */
export const breakoutSignal = (opts: { lookback: number }) => {
    const { lookback } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const out: TriSignal[] = new Array(close.length).fill(0);
        for (let i = 0; i < close.length; i++) {
            if (i < lookback) { out[i] = 0; continue; }
            let hi = -Infinity, lo = Infinity;
            for (let j = i - lookback; j < i; j++) {
                if (close[j] > hi) hi = close[j];
                if (close[j] < lo) lo = close[j];
            }
            out[i] = close[i] > hi ? 1 : close[i] < lo ? -1 : 0;
        }
        return out;
    };
};

/** Mean Reversion (z-score vs SMA) */
export const meanRevSignal = (opts: { len: number; zEntry: number }) => {
    const { len, zEntry } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series.close;
        const m = sma(close, len);
        const out: TriSignal[] = new Array(close.length).fill(0);
        // rolling std
        for (let i = 0; i < close.length; i++) {
            if (i < len) continue;
            let sum = 0, sum2 = 0;
            for (let j = i - len + 1; j <= i; j++) { sum += close[j]; sum2 += close[j] * close[j]; }
            const mean = sum / len;
            const varr = Math.max(sum2 / len - mean * mean, 0);
            const sd = Math.sqrt(varr);
            const z = sd === 0 ? 0 : (close[i] - m[i]) / sd;
            out[i] = z <= -zEntry ? 1 : z >= zEntry ? -1 : 0;
        }
        return out;
    };
};

/** Volatility Filter Wrapper: gates any base signal when vol is too high/low */
export const withVolFilter = (base: SignalFn, opts: { closeKey?: keyof OHLCV; ewmaLen?: number; maxAnnVol?: number; minAnnVol?: number }) => {
    const { closeKey = 'close', ewmaLen = 20, maxAnnVol = Infinity, minAnnVol = 0 } = opts;
    return (series: number[] | OHLCV): TriSignal[] => {
        const close = Array.isArray(series) ? series : series[closeKey] as number[];
        const rets: number[] = close.map((c, i) => i === 0 ? 0 : Math.log(c / close[i - 1]));
        // EWMA variance
        const k = 2 / (ewmaLen + 1);
        const varEW: number[] = new Array(close.length).fill(NaN);
        varEW[0] = rets[0] * rets[0];
        for (let i = 1; i < rets.length; i++) varEW[i] = k * rets[i] * rets[i] + (1 - k) * varEW[i - 1];
        const annVol = varEW.map(v => Math.sqrt(v) * Math.sqrt(252));

        const baseOut = base(series);
        return baseOut.map((s, i) => {
            const v = annVol[i];
            if (!isFinite(v)) return 0;
            return (v > maxAnnVol || v < minAnnVol) ? 0 : s;
        });
    };
};

/** Ensemble (majority vote across signals) */
export const ensemble = (signals: SignalFn[]): SignalFn => {
    return (series: number[] | OHLCV): TriSignal[] => {
        const outs = signals.map(s => s(series));
        const n = Array.isArray(series) ? series.length : series.close.length;
        const out: TriSignal[] = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            let score = 0;
            for (const arr of outs) score += arr[i] ?? 0;
            out[i] = score > 0 ? 1 : score < 0 ? -1 : 0;
        }
        return out;
    };
};
