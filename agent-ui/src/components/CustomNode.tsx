import { Handle, Position } from "reactflow";

export default function CustomNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 text-white shadow-md">
      <div className="text-sm font-semibold">{data.label}</div>

      {/* Handles on all sides */}
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-cyan-400" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-indigo-400" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-green-400" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-pink-400" />

      {data.config?.token && (
        <div className="mt-2 text-xs text-gray-300">
          <p>Token: <span className="text-cyan-400">{data.config.token}</span></p>
          <p>Amount: <span className="text-green-400">{data.config.amount}</span></p>
          {data?.config?.recipient && (
        <div className="text-xs text-gray-300">
          Recipient:{" "}
          <span className="text-indigo-400 break-all">{data.config.recipient}</span>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
