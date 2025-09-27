const protocols = {
  Aave: ["Supply", "Borrow", "Repay", "Withdraw"],
  Uniswap: ["Swap", "Add LP", "Remove LP"],
  Curve: ["Deposit", "Withdraw"],
  Compound: ["Supply", "Borrow"],
};

export default function ProtocolsPanel({ addNode }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-4 text-cyan-300">Protocols</h2>
      {Object.entries(protocols).map(([protocol, actions]) => (
        <div key={protocol} className="mb-6">
          <h3 className="text-sm font-medium mb-2 text-gray-300">{protocol}</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => addNode(protocol, action)}
                className="px-3 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
