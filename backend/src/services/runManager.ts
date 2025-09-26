import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { loadDB, saveDB } from "./storage";
import { randomUUID } from "node:crypto";
import type { Run, Strategy } from "./types";

class RunManagerClass {
    private procs = new Map<string, ChildProcessWithoutNullStreams>();
    private emitters = new Map<string, EventEmitter>();

    startRun(strategy: Strategy, params: Record<string, any>): Run {
        const db = loadDB();
        const run: Run = {
            id: randomUUID(),
            strategyId: strategy.id,
            params,
            status: "running",
            startedAt: Date.now(),
            logs: [],
        };
        db.runs.push(run);
        saveDB(db);

        const emitter = new EventEmitter();
        this.emitters.set(run.id, emitter);

        const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
        // Resolve script relative to repository root (backend/src/services -> src -> backend -> repo root)
        const scriptPath = path.resolve(__dirname, "..", "..", "..", strategy.scriptPath);

        // If the script file doesn't exist, mark the run as errored and notify subscribers
        if (!fs.existsSync(scriptPath)) {
            console.error(`Run script not found: ${scriptPath}`);
            run.status = "error";
            run.finishedAt = Date.now();
            // persist and notify
            saveDB(db);
            const emitter = this.emitters.get(run.id);
            if (emitter) emitter.emit("status", { type: "status", status: run.status });
            return run;
        }

        const env = { ...process.env, ...toEnv(params) };
        const p = spawn(cmd, ["tsx", scriptPath], { env });

        this.procs.set(run.id, p);

        const handleLog = (buf: Buffer) => {
            const line = buf.toString();
            run.logs.push(line);
            emitter.emit("log", { type: "log", line });
            saveDB(db);
        };

        p.stdout.on("data", handleLog);
        p.stderr.on("data", handleLog);

        p.on("error", (err) => {
            console.error("Run error:", err);
            run.status = "error";
            run.finishedAt = Date.now();
            emitter.emit("status", { type: "status", status: run.status });
            this.procs.delete(run.id);
            saveDB(db);
        });

        p.on("exit", (code) => {
            run.status = code === 0 ? "exited" : "error";
            run.finishedAt = Date.now();
            emitter.emit("status", { type: "status", status: run.status });
            this.procs.delete(run.id);
            saveDB(db);
        });

        return run;
    }

    getRun(runId: string) {
        return loadDB().runs.find((r: Run) => r.id === runId);
    }

    subscribe(runId: string, fn: (evt: any) => void) {
        const emitter = this.emitters.get(runId) ?? new EventEmitter();
        this.emitters.set(runId, emitter);
        emitter.on("log", fn).on("status", fn);
        return () => emitter.off("log", fn).off("status", fn);
    }

    kill(runId: string) {
        const p = this.procs.get(runId);
        if (!p) return false;
        p.kill("SIGTERM");
        return true;
    }
}

const toEnv = (params: Record<string, any>) =>
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k.toUpperCase(), String(v)]));

export const RunManager = new RunManagerClass();
