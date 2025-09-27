// src/pages/DeployPage.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ParamForm from "../components/ParamForm";
import LogsViewer from "../components/LogsViewer";
import DeployControls from "../components/DeployControls";

interface Strategy {
  id: string;
  name: string;
  description: string;
  scriptPath: string;
  metadata: Record<string, unknown>;
  params?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export default function DeployPage() {
  const { id } = useParams<{ id: string }>();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  // Fetch strategy
  useEffect(() => {
    if (!id) return;
    const fetchStrategy = async () => {
      try {
        const res = await fetch(`http://localhost:3000/strategies/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setStrategy(data.strategy);
        setParams(data.strategy.params || {}); // preload defaults
      } catch (err) {
        console.error("Error fetching strategy:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategy();
  }, [id]);

  const handleDeploy = () => {
    if (!id) return;
    setLogs([]);
    setRunning(true);

    const evtSource = new EventSource(
      `http://localhost:3000/strategies/${id}/run-stream`
    );

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
          setLogs((prev) => [...prev, data.line]);
        } else if (data.type === "status") {
          setLogs((prev) => [...prev, `Status: ${data.status}`]);
          if (["exited", "error"].includes(data.status)) {
            evtSource.close();
            setRunning(false);
          }
        }
      } catch (err) {
        console.warn("Failed to parse SSE message", err);
      }
    };

    evtSource.onerror = () => {
      setLogs((prev) => [...prev, "❌ Error streaming logs"]);
      evtSource.close();
      setRunning(false);
    };
  };

  // Run/funding state
  const [runId, setRunId] = useState<string | null>(null);
  const [botAddress, setBotAddress] = useState<string | null>(null);
  const [stepsInput, setStepsInput] = useState<string>("50");
  const [liveDurationInput, setLiveDurationInput] = useState<string>("");

  const createRun = async (live = false) => {
    if (!id) return;
    setLogs([]);
    setRunning(true);
    try {
      const runConfig: { steps?: number; liveDurationSec?: number; params?: Record<string, unknown> } = {};
      const stepsNum = Number(stepsInput);
      if (Number.isFinite(stepsNum) && stepsNum > 0) runConfig.steps = Math.floor(stepsNum);
      const liveDur = Number(liveDurationInput);
      if (Number.isFinite(liveDur) && liveDur > 0) runConfig.liveDurationSec = liveDur;
      runConfig.params = params || {};

      const payload = {
        strategyId: id,
        params: {
          ...(params || {}),
          RUN_PARAMS: JSON.stringify(runConfig),
          simulateOnly: !live,
        },
        owner: localStorage.getItem("userId") || undefined,
      };

      const res = await fetch("http://localhost:3000/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setRunId(data.id);
      setBotAddress(data.botAddress || null);
      setLogs((prev) => [...prev, `Run created: ${data.id} status=${data.status}`]);

      const sse = new EventSource(`http://localhost:3000/runs/${data.id}/logs`);
      sse.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === "log") setLogs((p) => [...p, d.line]);
          if (d.type === "status") setLogs((p) => [...p, `Status: ${d.status}`]);
        } catch (err) {
          console.warn("Failed to parse run SSE message", err);
        }
      };
      sse.onerror = () => {
        setLogs((p) => [...p, "SSE error"]);
        sse.close();
      };

    } catch (err) {
      console.error(err);
      setLogs((p) => [...p, `Error creating run: ${String(err)}`]);
      setRunning(false);
    }
  };

  const fundRun = async (amount = "0.05") => {
    if (!runId) return;
    try {
      const res = await fetch(`http://localhost:3000/runs/${runId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.ok) setLogs((p) => [...p, `Funded run ${runId} tx=${data.txHash}`]);
      else setLogs((p) => [...p, `Fund error: ${JSON.stringify(data)}`]);
    } catch (err) {
      setLogs((p) => [...p, `Fund request failed: ${String(err)}`]);
    }
  };

  if (loading) {
    return <p className="p-8 text-gray-400">Loading strategy...</p>;
  }
  if (!strategy) {
    return <p className="p-8 text-red-400">Strategy not found</p>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto text-gray-200">
      <h1 className="text-2xl font-semibold mb-1 capitalize">
        Deploy {strategy.name}
      </h1>
      <p className="text-gray-400 mb-5 text-sm">{strategy.description}</p>

      {/* Params */}
      <div className="backdrop-blur-md bg-gray-800/40 border border-gray-700 rounded-md p-4 mb-6">
        <ParamForm strategy={strategy} params={params} setParams={setParams} />
      </div>

      {/* Controls */}
      <DeployControls running={running} onDeploy={handleDeploy} />

      {/* Run/Funding */}
      <div className="mt-6 backdrop-blur-md bg-gray-800/40 border border-gray-700 rounded-md p-4">
        <h3 className="font-medium mb-3 text-sm">Run / Funding</h3>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 text-xs border border-gray-600 rounded-md hover:bg-gray-700 transition"
            onClick={() => createRun(false)}
          >
            Create (simulate)
          </button>
          <button
            className="px-2 py-1 text-xs border border-gray-600 rounded-md hover:bg-gray-700 transition"
            onClick={() => createRun(true)}
          >
            Create (live)
          </button>
          <button
            className="px-2 py-1 text-xs border border-gray-600 rounded-md hover:bg-gray-700 transition"
            onClick={() => fundRun("0.05")}
          >
            Fund 0.05 ETH
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-400 flex items-center">
            Steps
            <input
              className="ml-2 px-2 py-1 bg-gray-900/50 border border-gray-700 rounded-md text-xs w-20"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-400 flex items-center">
            Live duration (sec)
            <input
              className="ml-2 px-2 py-1 bg-gray-900/50 border border-gray-700 rounded-md text-xs w-24"
              value={liveDurationInput}
              onChange={(e) => setLiveDurationInput(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 text-xs text-gray-400">
          <div>Run ID: {runId ?? "—"}</div>
          <div>Bot: {botAddress ?? "—"}</div>
        </div>
      </div>

      {/* Logs */}
      <div className="mt-6 backdrop-blur-md bg-gray-800/40 border border-gray-700 rounded-md p-4">
        <LogsViewer logs={logs} />
      </div>
    </div>
  );
}
