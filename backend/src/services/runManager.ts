import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { JsonRpcProvider, formatEther } from "ethers";
import { loadDB, saveDB } from "./storage";
import { randomUUID } from "node:crypto";
import type { Run, Strategy } from "./types";

class RunManagerClass {
    private procs = new Map<string, ChildProcessWithoutNullStreams>();
    private emitters = new Map<string, EventEmitter>();
    // Simple bot pool: addresses/private keys (for demo with Anvil). Provide via env BOT_KEYS as JSON array or default to common dev keys.
    private botKeys: string[] = process.env.BOT_KEYS ? JSON.parse(process.env.BOT_KEYS) : [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
        "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
        "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
        "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
        "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
        "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
    ];
    private nextBot = 0;
    private provider = new JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");

    startRun(strategy: Strategy, params: Record<string, any>): Run {
        const db = loadDB();
        const run: Run = {
            id: randomUUID(),
            strategyId: strategy.id,
            params,
            status: params.simulateOnly ? "running" : "waiting_for_funds",
            startedAt: Date.now(),
            logs: [],
        };
        // allocate bot from pool if live run
        if (!params.simulateOnly) {
            const idx = this.nextBot % this.botKeys.length;
            this.nextBot += 1;
            // derive address from key using ethers
            const wallet = new (require("ethers").Wallet)(this.botKeys[idx]);
            run.botAddress = wallet.address;
            run.botIndex = idx;
            run.logs.push(`[runManager] allocated bot ${wallet.address} (index ${idx})`);
        }
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

        // If simulateOnly, start immediately. If live, wait for funding then start.
        if (params.simulateOnly) {
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
        } else {
            // live run: wait for ETH funding on run.botAddress then spawn process with env that includes BOT_PRIVATE_KEY
            const botIdx = run.botIndex!;
            const botKey = this.botKeys[botIdx];
            const wallet = new (require("ethers").Wallet)(botKey);
            const watchInterval = Number(process.env.FUND_POLL_INTERVAL_MS ?? 3000);
            const requiredEth = Number(process.env.FUND_REQUIRED_ETH ?? 0.02);

            const checkAndStart = async () => {
                try {
                    const bal = await this.provider.getBalance(wallet.address);
                    const eth = Number(formatEther(bal));
                    run.logs.push(`[runManager] balance for ${wallet.address} = ${eth} ETH`);
                    emitter.emit("log", { type: "log", line: `balance:${eth}` });
                    saveDB(db);
                    if (eth >= requiredEth) {
                        run.status = "running";
                        emitter.emit("status", { type: "status", status: run.status });
                        // spawn with BOT_PRIVATE_KEY in env so the script can use it
                        const env = { ...process.env, ...toEnv(params), BOT_PRIVATE_KEY: botKey };
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
                        return true;
                    }
                } catch (e) {
                    run.logs.push(`[runManager] balance check error: ${String(e)}`);
                    saveDB(db);
                }
                return false;
            };

            // start polling until funded
            const interval = setInterval(async () => {
                const started = await checkAndStart();
                if (started) clearInterval(interval);
            }, watchInterval);
            // initial immediate check
            checkAndStart();
        }

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
