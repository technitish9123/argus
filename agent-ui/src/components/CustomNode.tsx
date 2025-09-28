import { Handle, Position } from "reactflow";

export default function CustomNode({ data }: { data: any }) {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700/60 text-white/90 shadow-sm text-xs">
      <div className="text-[8px] font-thin text-gray-200">{data.label}</div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 bg-cyan-400/80" />
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 bg-indigo-400/80" />
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 bg-green-400/80" />
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 bg-pink-400/80" />

      {data.config?.token && (
        <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-400 leading-snug">
          <p>
            Token: <span className="text-cyan-400">{data.config.token}</span>
          </p>
          <p>
            Amount: <span className="text-green-400">{data.config.amount}</span>
          </p>
          {data?.config?.recipient && (
            <p>
              Recipient:{" "}
              <span className="text-indigo-400 break-all">{data.config.recipient}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
