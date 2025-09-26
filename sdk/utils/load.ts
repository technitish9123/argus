import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { OHLCV } from "../signals";

/**
 * Load OHLCV data from a CSV file into { open, high, low, close, volume }
 * 
 * CSV format assumed: timestamp, open, high, low, close, volume
 * - timestamp is ignored (can be added if needed)
 * - volume optional
 */
export async function loadCSV(filePath: string): Promise<OHLCV> {
    const absPath = path.resolve(filePath);
    const csv = fs.readFileSync(absPath, "utf8");

    return new Promise((resolve, reject) => {
        Papa.parse(csv, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                const rows = results.data as any[];

                const open: number[] = [];
                const high: number[] = [];
                const low: number[] = [];
                const close: number[] = [];
                const volume: number[] = [];

                for (const row of rows) {
                    open.push(+row.open || +row.Open);
                    high.push(+row.high || +row.High);
                    low.push(+row.low || +row.Low);
                    close.push(+row.close || +row.Close);
                    if (row.volume !== undefined || row.Volume !== undefined) {
                        volume.push(+row.volume || +row.Volume);
                    }
                }

                const ohlcv: OHLCV = { open, high, low, close };
                if (volume.length > 0) ohlcv.volume = volume;

                resolve(ohlcv);
            },
            error: (err: any) => reject(err),
        });
    });
}
