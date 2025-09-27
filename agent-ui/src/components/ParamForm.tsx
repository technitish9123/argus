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

  // Special case for trading agent
  if (strategy.name === "trading agent") {
    return (
      <div className="space-y-6 mb-8">
        {/* Core */}
        <div>
          <label className="block mb-2 font-medium">Symbol</label>
          <select
            value={params.symbol || "ETH-USD"}
            onChange={(e) => setParams({ ...params, symbol: e.target.value })}
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          >
            <option>ETH-USD</option>
            <option>BTC-USD</option>
          </select>
        </div>
        <div>
          <label className="block mb-2 font-medium">Equity</label>
          <input
            type="number"
            value={params.equity || 100000}
            onChange={(e) => setParams({ ...params, equity: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Risk Level</label>
          <select
            value={params.risk || "medium"}
            onChange={(e) => setParams({ ...params, risk: e.target.value })}
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-sm text-cyan-400 underline"
        >
          {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-700 pt-4">
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
                <label className="block mb-2 font-medium">{key}</label>
                <input
                  type="number"
                  value={params[key] ?? def}
                  onChange={(e) =>
                    setParams({ ...params, [key]: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
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
      <div className="space-y-6 mb-8">
        {Object.entries(strategy.params).map(([key, val]) => (
          <div key={key}>
            <label className="block mb-2 font-medium capitalize">{key}</label>
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
              className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700"
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
