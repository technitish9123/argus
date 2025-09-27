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

      {/* Logs */}
      <LogsViewer logs={logs} />
    </div>
  );
}
