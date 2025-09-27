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
  const [search, setSearch] = useState("");

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

  const filteredStrategies = strategies.filter((s) => {
    const matchesRisk =
      riskFilter === "all" ||
      s.metadata.risk.toLowerCase() === riskFilter.toLowerCase();
    const matchesSearch = s.name
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8 text-white/90 text-center">
        Available DeFi Strategies
      </h1>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
        <input
          type="text"
          placeholder="Search strategies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 w-full md:w-1/2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 backdrop-blur-md text-sm text-gray-200 placeholder-gray-400 focus:outline-none focus:border-cyan-400"
        />

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 backdrop-blur-md text-gray-200 focus:outline-none focus:border-cyan-400"
        >
          <option value="all">All Risks</option>
          <option value="low">Low Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="high">High Risk</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-400">Loading strategies...</p>
      ) : filteredStrategies.length === 0 ? (
        <p className="text-center text-gray-500">No strategies found.</p>
      ) : (
        <div className="space-y-5">
          {filteredStrategies.map((s) => (
            <div
              key={s.id}
              className="p-5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md shadow-sm hover:border-cyan-400/40 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left */}
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white/90 capitalize">
                    {s.name}
                  </h2>
                  <p className="text-gray-400 text-sm mb-3">
                    {s.description}
                  </p>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <p>
                      <span className="text-gray-300">Risk:</span>{" "}
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
                   
                  </div>
                </div>

                {/* Right */}
                <div>
                  <Link
                    to={`/deploy/${s.id}`}
                    className="px-3 py-1.5 text-sm text-gray-200 border border-gray-700 bg-gray-800/40 rounded-md hover:bg-gray-700 hover:text-white transition"
                  >
                    Deploy
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
