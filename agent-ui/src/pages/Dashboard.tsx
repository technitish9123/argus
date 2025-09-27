import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Strategy {
  id: string;
  name: string;
  description: string;
  scriptPath: string;
  metadata: { risk?: string };
  createdAt: number;
  updatedAt: number;
}

interface Run {
  id: string;
  strategyId: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number;
  owner?: string;
}

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // load lightweight user id (wallet address) from localStorage if set by Layout wallet connect
    const uid = localStorage.getItem("userId") || null;
    setUserId(uid);
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/strategies");
        const data = await res.json();
        setStrategies(data);

        // collect runs across all strategies
        const allRuns: Run[] = [];
        for (const s of data) {
          const resRuns = await fetch(`http://localhost:3000/strategies/${s.id}`);
          const dataRuns = await resRuns.json();
          allRuns.push(...(dataRuns.runs || []));
        }
        setRuns(allRuns.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error("Error loading dashboard:", err);
      }
    };
    fetchData();
  }, []);

  // If a user is connected, prefer showing only strategies they've deployed
  let filteredStrategies = strategies.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  if (userId) {
    const deployedStrategyIds = new Set(runs.filter((r) => r.owner === userId).map((r) => r.strategyId));
    filteredStrategies = filteredStrategies.filter((s) => deployedStrategyIds.has(s.id));
  }

  // Runs that belong to current user
  const myRuns = userId ? runs.filter((r) => r.owner === userId) : [];

  // Helper to refresh runs after start/stop
  const refreshRuns = async () => {
    try {
      const res = await fetch("http://localhost:3000/strategies");
      const data = await res.json();
      setStrategies(data);
      const allRuns: Run[] = [];
      for (const s of data) {
        const resRuns = await fetch(`http://localhost:3000/strategies/${s.id}`);
        const dataRuns = await resRuns.json();
        allRuns.push(...(dataRuns.runs || []));
      }
      setRuns(allRuns.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("Error refreshing runs:", err);
    }
  };

  // Start/Stop handlers
  const handleStop = async (runId: string) => {
    await fetch(`http://localhost:3000/runs/${runId}/kill`, { method: "POST" });
    setTimeout(refreshRuns, 500); // allow backend to update
  };
  const handleStart = async (runId: string) => {
    await fetch(`http://localhost:3000/runs/${runId}/start`, { method: "POST" });
    setTimeout(refreshRuns, 500);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
           My Agents
        </h1>
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* Agents Grid */}
   {/* Agents Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
  {filteredStrategies.length === 0 ? (
    <div className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-gray-300 text-sm">
      {userId ? (
        <div>You haven't deployed any strategies yet.</div>
      ) : (
        <div>No strategies match your search.</div>
      )}
    </div>
  ) : (
    filteredStrategies.map((s) => (
      <div
        key={s.id}
        className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md bg-clip-padding shadow-sm hover:shadow-cyan-400/10 transition"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white/90 capitalize">
            {s.name}
          </h2>
          <span
            className={`px-2 py-0.5 text-[11px] rounded-full backdrop-blur-sm ${
              s.metadata?.risk === "high"
                ? "bg-red-500/20 text-red-400"
                : s.metadata?.risk === "medium"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {s.metadata?.risk || "N/A"}
          </span>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          {s.description}
        </p>

        {/* Hardcoded Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs text-gray-300">
          <div className="p-2 rounded bg-gray-800/40 border border-gray-700/30 text-center">
            <div className="font-semibold text-white/90">24</div>
            <div className="text-[11px]">Runs</div>
          </div>
          <div className="p-2 rounded bg-gray-800/40 border border-gray-700/30 text-center">
            <div className="font-semibold text-emerald-400">82%</div>
            <div className="text-[11px]">Success</div>
          </div>
          <div className="p-2 rounded bg-gray-800/40 border border-gray-700/30 text-center">
            <div className="font-semibold text-white/90">3.2h</div>
            <div className="text-[11px]">Avg Runtime</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center text-sm">
          <Link
            to={`/deploy/${s.id}`}
            className="
              px-3 py-1.5 
              text-sm font-medium
              text-gray-200
              bg-gray-800/50 
              border border-gray-700
              rounded-md 
              hover:bg-gray-700/50 
              hover:text-white
              transition
            "
          >
            🚀 Deploy
          </Link>
          <button className="px-3 py-1.5 text-sm text-gray-400 border border-gray-700 rounded-md hover:text-red-400 hover:border-red-500 transition">
            🗑 Delete
          </button>
        </div>
      </div>
    ))
  )}
</div>


      {/* My Agents */}
      <h2 className="text-xl  mb-6">My Agents</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {myRuns.length === 0 ? (
          <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 text-gray-300">
            You have no deployed agents yet. Deploy a strategy to make it yours.
          </div>
        ) : (
          myRuns.map((r) => {
            const strat = strategies.find((s) => s.id === r.strategyId);
            const isLive = r.status === "running";
            const isPending = r.status === "waiting_for_funds";
            const canStart = ["exited", "error", "killed"].includes(r.status);
            const canStop = isLive;
            return (
              <div key={r.id} className="p-5 rounded-xl bg-white/6 backdrop-blur-md border border-white/6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white/95">{strat?.name}</div>
                    <div className="text-sm text-gray-300">{strat?.description}</div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${isLive ? 'bg-emerald-500/20 text-emerald-400' : isPending ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-600/10 text-gray-300'}`}>
                      {isLive ? 'LIVE' : isPending ? 'PENDING' : r.status.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">{new Date(r.startedAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link to={`/deploy/${r.strategyId}`} className="text-sm bg-indigo-600 px-3 py-1 rounded text-white">Manage</Link>
                  <div className="flex gap-2">
                    {canStart && (
                      <button onClick={() => handleStart(r.id)} className="text-sm bg-emerald-600 px-3 py-1 rounded text-white hover:bg-emerald-500">Start</button>
                    )}
                    {canStop && (
                      <button onClick={() => handleStop(r.id)} className="text-sm bg-red-600 px-3 py-1 rounded text-white hover:bg-red-500">Stop</button>
                    )}
                  </div>
                  <div className="text-sm text-gray-300">Run: {r.id.slice(0, 8)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Runs */}
      {/* <h2 className="text-2xl font-bold mb-6">📊 Recent Activity</h2>
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow">
        {runs.length === 0 ? (
          <p className="text-gray-400">No runs yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {runs.slice(0, 10).map((r) => (
              <li
                key={r.id}
                className="flex justify-between border-b border-gray-800 pb-2"
              >
                <span>
                  <strong>{strategies.find((s) => s.id === r.strategyId)?.name}</strong>{" "}
                  – {r.status}
                </span>
                <span className="text-gray-400">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div> */}
    </div>
  );
}
