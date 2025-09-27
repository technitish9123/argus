import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Strategy {
  id: string;
  name: string;
  description: string;
  scriptPath: string;
  metadata: {
    risk: "low" | "medium" | "high" | string;
  };
  createdAt: number;
  updatedAt: number;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>("all");

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const res = await fetch("http://localhost:3000/strategies");
        const data = await res.json();
        setStrategies(data);
      } catch (err) {
        console.error("Error fetching strategies:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  const filteredStrategies =
    riskFilter === "all"
      ? strategies
      : strategies.filter((s) => s.metadata.risk.toLowerCase() === riskFilter);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-extrabold mb-10 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent text-center">
        🚀 Available DeFi Strategies
      </h1>

      {/* Search + Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search strategies..."
          className="flex-1 w-full md:w-1/2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />

        {/* Filter by Risk */}
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          <option value="all">All Risks</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      {/* Loading State */}
      {loading ? (
        <p className="text-center text-gray-400">Loading strategies...</p>
      ) : filteredStrategies.length === 0 ? (
        <p className="text-center text-gray-400">No strategies found.</p>
      ) : (
        <div className="space-y-6">
          {filteredStrategies.map((s) => (
            <div
              key={s.id}
              className="flex flex-col md:flex-row items-start justify-between rounded-2xl border border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800 shadow-lg p-6 hover:shadow-cyan-500/40 transition-all duration-300"
            >
              {/* Left content */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2 capitalize">{s.name}</h2>
                <p className="text-gray-400 mb-4">{s.description}</p>

                <div className="flex flex-wrap gap-6 text-sm">
                  <p>
                    <span className="font-semibold text-gray-300">Script:</span>{" "}
                    <span className="text-cyan-400">{s.scriptPath}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-300">Risk:</span>{" "}
                    <span
                      className={
                        s.metadata.risk === "high"
                          ? "text-red-400"
                          : s.metadata.risk === "medium"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }
                    >
                      {s.metadata.risk}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-300">Created:</span>{" "}
                    <span className="text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              </div>

              {/* Right action */}
              <div className="mt-4 md:mt-0 md:ml-6">
                <Link
                  to={`/deploy/${s.id}`}
                  className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition"
                >
                  Deploy Strategy
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
