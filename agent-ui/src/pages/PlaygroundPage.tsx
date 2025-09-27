import { useCallback, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  type Edge,
  type OnConnect,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import CustomNode from "../components/CustomNode";
import Sidebar from "../components/Sidebar";
import FloatingControls from "../components/FloatingControls";

const nodeTypes = { custom: CustomNode };

const tokenList = ["ETH", "DAI", "USDC", "USDT", "stETH"];

export default function PlaygroundPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([
    {
      id: "1",
      type: "custom",
      position: { x: 100, y: 100 },
      data: { label: "Start" },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Modal state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configToken, setConfigToken] = useState("ETH");
  const [configAmount, setConfigAmount] = useState("");

  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: "#38bdf8", strokeWidth: 2 },
            markerEnd: { type: "arrowclosed", width: 20, height: 20, color: "#38bdf8" },
            animated: true,
          },
          eds
        )
      ),
    []
  );

  const addNode = (category: string, action: string) => {
    const id = `${nodes.length + 1}`;
    const newNode: Node = {
      id,
      type: "custom",
      position: { x: 250 + Math.random() * 300, y: 150 + Math.random() * 200 },
      data: { label: `${category}: ${action}`, category, action, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
  };

  const resetCanvas = () => {
    setNodes([
      {
        id: "1",
        type: "custom",
        position: { x: 100, y: 100 },
        data: { label: "Start" },
      },
    ]);
    setEdges([]);
    setSelectedNode(null);
  };

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
    setConfigToken(node.data?.config?.token || "ETH");
    setConfigAmount(node.data?.config?.amount || "");
    setIsConfigOpen(true);
  };

  const saveConfig = () => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                config: { token: configToken, amount: configAmount },
              },
            }
          : n
      )
    );
    setIsConfigOpen(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex bg-gray-950 text-white">
      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          nodeTypes={nodeTypes}
        >
          <Controls />
          <Background color="#444" gap={16} />
        </ReactFlow>

        <FloatingControls
          deleteNode={deleteNode}
          resetCanvas={resetCanvas}
          selectedNode={selectedNode}
        />

        {/* Config Modal */}
        {isConfigOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
            <div className="bg-gray-900 p-6 rounded-xl w-80 shadow-lg border border-cyan-500/30">
              <h2 className="text-lg font-semibold mb-4 text-cyan-300">
                Configure Node
              </h2>

              <label className="block mb-2 text-sm">Token</label>
              <select
                value={configToken}
                onChange={(e) => setConfigToken(e.target.value)}
                className="w-full mb-4 px-3 py-2 rounded bg-gray-800 border border-gray-600"
              >
                {tokenList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label className="block mb-2 text-sm">Amount</label>
              <input
                type="number"
                value={configAmount}
                onChange={(e) => setConfigAmount(e.target.value)}
                className="w-full mb-6 px-3 py-2 rounded bg-gray-800 border border-gray-600"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveConfig}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar addNode={addNode} selectedNode={selectedNode} />
    </div>
  );
}
