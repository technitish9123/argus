
import express from "express";
import { loadDB, saveDB } from "../services/storage";
import { RunManager } from "../services/runManager";

const router = express.Router();
router.use(express.json());

router.get("/:id", (req, res) => {
    const db = loadDB();
    const run = db.runs.find((r) => r.id === req.params.id);
    if (!run) return res.status(404).json({ error: "not found" });
    res.json(run);
});

// SSE logs
router.get("/:id/logs", (req, res) => {
    const runId = req.params.id;
    const run = loadDB().runs.find((r) => r.id === runId);
    if (!run) return res.status(404).end();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // send existing logs
    for (const line of run.logs) {
        res.write(`data: ${JSON.stringify({ type: "log", line })}\n\n`);
    }

    const onEvt = (evt: any) => {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };
    const unsub = RunManager.subscribe(runId, onEvt);

    req.on("close", () => {
        unsub();
    });
});

router.post("/:id/kill", (req, res) => {
    const ok = RunManager.kill(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found or not running" });
    res.json({ ok: true });
});

// Create a new run (simulateOnly or live). Returns run id and botAddress if allocated for live runs.
router.post("/", async (req, res) => {
    const { strategyId, params, owner } = req.body as { strategyId: string; params?: Record<string, any>; owner?: string };
    const db = loadDB();
    const strategy = db.strategies.find((s) => s.id === strategyId);
    if (!strategy) return res.status(404).json({ error: "strategy not found" });
    const run = RunManager.startRun(strategy, params || {});
    if (owner) run.owner = owner;
    // save DB with run inserted
    db.runs = db.runs || [];
    db.runs.push(run);
    // persist via storage helper
    saveDB(db);
    res.json({ id: run.id, status: run.status, botAddress: run.botAddress });
});

// Dev-only: fund the allocated bot address for a run. This helps demos where
// users can click 'Fund' and the server will transfer test ETH to the bot.
router.post("/:id/fund", async (req, res) => {
    const runId = req.params.id;
    const db = loadDB();
    const run = db.runs.find((r) => r.id === runId);
    if (!run) return res.status(404).json({ error: "run not found" });
    if (!run.botAddress) return res.status(400).json({ error: "run has no botAddress allocated" });

    // dev funder key: prefer env DEV_FUNDER_KEY otherwise fall back to first BOT_KEYS item
    const devKey = process.env.DEV_FUNDER_KEY || (process.env.BOT_KEYS ? JSON.parse(process.env.BOT_KEYS)[0] : undefined);
    if (!devKey) return res.status(500).json({ error: "no dev funder key configured" });

    try {
        const { Wallet, JsonRpcProvider, parseEther } = require("ethers");
        const provider = new JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
        const wallet = new Wallet(devKey, provider);
        const amount = req.body?.amount ?? process.env.DEV_FUND_AMOUNT ?? "0.05"; // default 0.05 ETH
        const tx = await wallet.sendTransaction({ to: run.botAddress, value: parseEther(String(amount)) });
        await tx.wait();
    // log into run logs
    run.logs.push(`[dev-fund] funded ${run.botAddress} with ${amount} ETH tx=${tx.hash}`);
    saveDB(db);
        res.json({ ok: true, txHash: tx.hash });
    } catch (e) {
        console.error("dev fund error", e);
        res.status(500).json({ error: String(e) });
    }
});


// Start a stopped run (exited/error/killed) by re-invoking RunManager.startRun with the same params
router.post("/:id/start", async (req, res) => {
    const db = loadDB();
    const run = db.runs.find((r) => r.id === req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    if (["running", "waiting_for_funds", "starting"].includes(run.status)) {
        return res.status(400).json({ error: "run is already running or pending" });
    }
    const strategy = db.strategies.find((s) => s.id === run.strategyId);
    if (!strategy) return res.status(404).json({ error: "strategy not found" });
    // Start a new run with same params and owner
    const newRun = RunManager.startRun(strategy, run.params);
    newRun.owner = run.owner;
    db.runs.push(newRun);
    saveDB(db);
    res.json({ id: newRun.id, status: newRun.status, botAddress: newRun.botAddress });
});

export default router;
