import fs from "node:fs";
import path from "node:path";
import { DB } from "./types";

// Keep the data directory relative to this file so the server can find
// backend/data/db.json regardless of the current working directory.
const dataDir = path.join(__dirname, "..", "..", "data");
const dbFile = path.join(dataDir, "db.json");

function ensureDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function loadDB(): DB {
    ensureDir();
    if (!fs.existsSync(dbFile)) return { strategies: [], runs: [] };
    try {
        const raw = fs.readFileSync(dbFile, "utf8");
        const parsed = JSON.parse(raw) as Partial<DB> | null;
        // Normalize shape: ensure arrays exist so callers can safely use .filter/.find
        const db: DB = {
            strategies: Array.isArray(parsed?.strategies) ? parsed!.strategies : [],
            runs: Array.isArray(parsed?.runs) ? parsed!.runs : [],
        };
        return db;
    } catch (e) {
        console.error("Failed to read DB file, returning empty DB:", e);
        return { strategies: [], runs: [] };
    }
}

export function saveDB(db: DB) {
    ensureDir();
    const tmp = dbFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, dbFile);
}
