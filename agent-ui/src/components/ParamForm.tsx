// src/components/ParamForm.tsx
import { useState } from "react";

export default function ParamForm({
  strategy,
  params,
  setParams,
}: {
  strategy: any;
  params: Record<string, any>;
  setParams: (p: any) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Shared compact input style
  const inputClass =
    "w-full h-8 px-2 text-sm rounded-md bg-gray-900/60 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-200";

  const labelClass = "block mb-1 text-xs font-medium text-gray-400";

  // Special case: trading agent
  if (strategy.name === "trading agent") {
    return (
      <div className="mb-6">
        {/* Core fields in a grid */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Symbol</label>
            <select
              value={params.symbol || "ETH-USD"}
              onChange={(e) => setParams({ ...params, symbol: e.target.value })}
              className={inputClass}
            >
              <option>ETH-USD</option>
              <option>BTC-USD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Equity</label>
            <input
              type="number"
              value={params.equity || 100000}
              onChange={(e) =>
                setParams({ ...params, equity: Number(e.target.value) })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Risk Level</label>
            <select
              value={params.risk || "medium"}
              onChange={(e) => setParams({ ...params, risk: e.target.value })}
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline"
        >
          {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
        </button>

        {/* Advanced grid */}
        {showAdvanced && (
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-700 pt-4">
            {Object.entries({
              fast: 20,
              slow: 50,
              rsiLen: 14,
              rsiOB: 70,
              rsiOS: 30,
              meanRevLen: 20,
              meanRevZ: 1.5,
              atrLen: 14,
              atrMult: 2,
              lots: 1,
              maxLeverage: 5,
            }).map(([key, def]) => (
              <div key={key}>
                <label className={labelClass}>{key}</label>
                <input
                  type="number"
                  value={params[key] ?? def}
                  onChange={(e) =>
                    setParams({ ...params, [key]: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default dynamic renderer
  if (strategy.params) {
    return (
      <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        {Object.entries(strategy.params).map(([key, val]) => (
          <div key={key}>
            <label className={labelClass}>{key}</label>
            <input
              type={typeof val === "number" ? "number" : "text"}
              value={params[key] ?? ""}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  [key]:
                    typeof val === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                }))
              }
              className={inputClass}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
