export default function ConfigPanel({ selectedNode }) {
  if (!selectedNode) return <p className="text-gray-400">Select a node to configure.</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-cyan-300">Configure: {selectedNode.data.label}</h2>
      {/* Example config form */}
      <label className="block mb-2 text-sm">Token</label>
      <select className="w-full mb-4 px-2 py-1 rounded bg-gray-800 border border-gray-600">
        <option>ETH</option>
        <option>DAI</option>
        <option>USDC</option>
        <option>USDT</option>
      </select>

      <label className="block mb-2 text-sm">Amount</label>
      <input
        type="number"
        placeholder="Enter amount"
        className="w-full px-2 py-1 rounded bg-gray-800 border border-gray-600"
      />
    </div>
  );
}
