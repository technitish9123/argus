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
}

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
          allRuns.push(...dataRuns.runs);
        }
        setRuns(allRuns.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error("Error loading dashboard:", err);
      }
    };
    fetchData();
  }, []);

  const filteredStrategies = strategies.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          🧑‍🚀 My Agents
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {filteredStrategies.map((s) => (
          <div
            key={s.id}
            className="p-6 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg hover:shadow-cyan-500/40 transition"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold capitalize">{s.name}</h2>
              <span
                className={`px-3 py-1 text-xs rounded-full ${
                  s.metadata.risk === "high"
                    ? "bg-red-500/20 text-red-400"
                    : s.metadata.risk === "medium"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {s.metadata.risk || "N/A"}
              </span>
            </div>
            <p className="text-gray-400 mb-4">{s.description}</p>
            <div className="flex justify-between text-sm">
              <Link
                to={`/deploy/${s.id}`}
                className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-semibold hover:scale-105 transition"
              >
                🚀 Deploy
              </Link>
              <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Runs */}
      <h2 className="text-2xl font-bold mb-6">📊 Recent Activity</h2>
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
      </div>
    </div>
  );
}
