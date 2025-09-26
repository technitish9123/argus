import express from "express";
import { loadDB, saveDB } from "../services/storage";
import { randomUUID } from "node:crypto";
import { RunManager } from "../services/runManager";
import type { Strategy } from "../services/types";

const router = express.Router();

const findStrategy = (db: any, id: string) =>
    db.strategies.find((s: Strategy) => s.id === id);

// --- CRUD ---

router.post("/", (req, res) => {
    const db = loadDB();
    const s: Strategy = {
        id: randomUUID(),
        name: req.body.name || "unnamed",
        description: req.body.description,
        scriptPath: req.body.scriptPath,
        metadata: req.body.metadata || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    db.strategies.push(s);
    saveDB(db);
    res.status(201).json(s);
});

router.get("/", (_, res) => res.json(loadDB().strategies));

router.get("/:id", (req, res) => {
    const db = loadDB();
    const s = findStrategy(db, req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    res.json({ strategy: s, runs: db.runs.filter((r: any) => r.strategyId === s.id) });
});

router.put("/:id", (req, res) => {
    const db = loadDB();
    const s = findStrategy(db, req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    Object.assign(s, req.body, { updatedAt: Date.now() });
    saveDB(db);
    res.json(s);
});

router.delete("/:id", (req, res) => {
    const db = loadDB();
    const idx = db.strategies.findIndex((x: any) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "not found" });
    db.strategies.splice(idx, 1);
    saveDB(db);
    res.json({ ok: true });
});

// --- Runs ---

router.post("/:id/runs", (req, res) => {
    const s = findStrategy(loadDB(), req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });
    const run = RunManager.startRun(s, req.body.params ?? {});
    res.status(201).json({ runId: run.id });
});

// Instead of POST
router.get("/:id/run-stream", (req, res) => {
    const db = loadDB();
    const s = db.strategies.find((x) => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: "not found" });

    const params = {}; // cannot pass body in GET
    const run = RunManager.startRun(s, params);

    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const safeWrite = (evt: any) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };

    // replay existing logs
    loadDB().runs.find((r) => r.id === run.id)?.logs.forEach((line: string) =>
        safeWrite({ type: "log", line })
    );

    const unsub = RunManager.subscribe(run.id, (evt) => {
        safeWrite(evt);
        if (evt.type === "status" && ["exited", "error"].includes(evt.status)) {
            unsub();
            res.end();
        }
    });

    req.on("close", unsub);
});


export default router;
