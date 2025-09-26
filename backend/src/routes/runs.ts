import express from "express";
import { loadDB } from "../services/storage";
import { RunManager } from "../services/runManager";

const router = express.Router();

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

export default router;
