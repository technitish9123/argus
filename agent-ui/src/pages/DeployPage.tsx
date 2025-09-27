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
  metadata: Record<string, any>;
  params?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export default function DeployPage() {
  const { id } = useParams<{ id: string }>();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);

  const [params, setParams] = useState<Record<string, any>>({});
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
      } catch {}
    };

    evtSource.onerror = () => {
      setLogs((prev) => [...prev, "❌ Error streaming logs"]);
      evtSource.close();
      setRunning(false);
    };
  };

  // New: create run via backend and optionally fund
  const [runId, setRunId] = useState<string | null>(null);
  const [botAddress, setBotAddress] = useState<string | null>(null);
  const createRun = async (live = false) => {
    if (!id) return;
    setLogs([]);
    setRunning(true);
    try {
      const res = await fetch("http://localhost:3000/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId: id, params: { ...(params || {}), simulateOnly: !live } }),
      });
      const data = await res.json();
      setRunId(data.id);
      setBotAddress(data.botAddress || null);
      setLogs((prev) => [...prev, `Run created: ${data.id} status=${data.status}`]);

      // subscribe to run logs SSE
      const sse = new EventSource(`http://localhost:3000/runs/${data.id}/logs`);
      sse.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === "log") setLogs((p) => [...p, d.line]);
          if (d.type === "status") setLogs((p) => [...p, `Status: ${d.status}`]);
        } catch (err) {}
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
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 capitalize">
        Deploy {strategy.name}
      </h1>
      <p className="text-gray-400 mb-6">{strategy.description}</p>

      {/* Params */}
      <ParamForm
        strategy={strategy}
        params={params}
        setParams={setParams}
      />

      {/* Controls */}
      <DeployControls
        running={running}
        onDeploy={handleDeploy}
      />

      {/* Run create / fund panel */}
      <div className="mt-6 bg-gray-900 p-4 rounded">
        <h3 className="font-semibold mb-2">Run / Funding</h3>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500"
            onClick={() => createRun(false)}
          >
            Create (simulate)
          </button>
          <button
            className="px-3 py-1 bg-emerald-600 rounded hover:bg-emerald-500"
            onClick={() => createRun(true)}
          >
            Create (live)
          </button>
          <button
            className="px-3 py-1 bg-yellow-600 rounded hover:bg-yellow-500"
            onClick={() => fundRun("0.05")}
          >
            Fund 0.05 ETH
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-300">
          <div>Run ID: {runId ?? "—"}</div>
          <div>Bot: {botAddress ?? "—"}</div>
        </div>
      </div>

      {/* Logs */}
      <LogsViewer logs={logs} />
    </div>
  );
}
