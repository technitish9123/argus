import { useCallback, useState, useEffect, useRef } from "react";
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
            // subtle thin grey line to blend with background
            style: { stroke: "#6b7280", strokeWidth: 1, strokeDasharray: "3 3", strokeLinecap: 'round', opacity: 0.9 },
            // smaller grey arrow marker
            markerEnd: { type: "arrowclosed", width: 10, height: 10, color: "#b1b3b6ff" },
            // disable animation for subtle look
            animated: false,
          },
          eds
        )
      ),
    [setEdges]
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

  const handleNodeClick = (_: MouseEvent | undefined, node: Node) => {
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

  const handleExport = useCallback(() => {
    const borrowSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "aave_v3.borrow",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "protocol": { "const": "aave_v3" },
        "contract": { "const": "pool" },
        "method":   { "const": "borrow" },
        "params": {
          "type": "object",
          "additionalProperties": false,
          "required": ["asset","amount","interestRateMode","referralCode","onBehalfOf"],
          "properties": {
            "asset":            { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
            "amount":           { "type": "string", "pattern": "^[0-9]+$" },
            "interestRateMode": { "type": "integer", "enum": [1,2] },
            "referralCode":     { "type": "integer", "minimum": 0 },
            "onBehalfOf":       { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" }
          }
        },
        "chainId": { "type": "integer", "minimum": 1 }
      },
      "required": ["protocol","contract","method","params"],
      "x-abi": "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
      "x-spenderRole": "pool"
    } as const;

    try {
      const content = JSON.stringify(borrowSchema, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aave_v3.borrow.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
  } catch {
      // fallback: copy to clipboard
      try {
        navigator.clipboard?.writeText(JSON.stringify(borrowSchema));
        alert('Failed to download file; schema copied to clipboard instead.');
      } catch {
        alert('Failed to export schema.');
      }
    }
  }, []);

  // Deploy modal / orchestration state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployProgress, setDeployProgress] = useState(0);
  const deployTimers = useRef<number[]>([]);
  const deployCancelled = useRef(false);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  const appendLog = (line: string) =>
    setDeployLogs((l) => [...l, `${new Date().toLocaleTimeString()} — ${line}`]);

  const startDeploy = () => {
    if (isDeploying) return;
    setDeployLogs([]);
    setDeployProgress(0);
    deployCancelled.current = false;
    setIsDeploying(true);

    const steps = [
      "Preparing strategy package",
      "Validating node graph",
      "Resolving on-chain dependencies",
      "Uploading artifacts",
      "Sending transactions",
      "Confirming transactions",
      "Finalizing deployment",
    ];

    // run steps sequentially with delays to simulate orchestration
    steps.forEach((s, i) => {
      const t = window.setTimeout(() => {
        if (deployCancelled.current) return;
        appendLog(s);
        setDeployProgress(Math.round(((i + 1) / steps.length) * 100));

        // finish
        if (i === steps.length - 1) {
          appendLog("Deployment complete ✅");
          // small delay to allow user to read
          const finishT = window.setTimeout(() => {
            if (!deployCancelled.current) setIsDeploying(false);
          }, 1000);
          deployTimers.current.push(finishT as unknown as number);
        }
      }, 800 + i * 900);
      deployTimers.current.push(t as unknown as number);
    });
  };

  const cancelDeploy = () => {
    deployCancelled.current = true;
    deployTimers.current.forEach((id) => clearTimeout(id));
    deployTimers.current = [];
    appendLog("Deployment cancelled by user");
    setIsDeploying(false);
    setDeployProgress(0);
  };

  useEffect(() => {
    return () => {
      // cleanup timers on unmount
      deployTimers.current.forEach((id) => clearTimeout(id));
      deployTimers.current = [];
    };
  }, []);

  // auto-scroll logs to bottom
  useEffect(() => {
    if (!logsContainerRef.current) return;
    const el = logsContainerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [deployLogs]);

  return (
    <div
      className="h-[calc(100vh-120px)] flex text-white"
      style={{
        background:
          'radial-gradient(circle at 10% 10%, rgba(99,102,241,0.04), transparent 20%), linear-gradient(180deg,#07070a 0%, #0b1220 100%)'
      }}
    >
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
          <Background color="#222" gap={20} />
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
      {/* Bottom Control Bar */}
<div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-6 py-4  bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-md">
  <div className="flex gap-3">
    <button onClick={handleExport} className="px-4 py-2 text-sm text-white/90 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition">
      Export JSON
    </button>
    <button className="px-4 py-2 text-sm text-white/80 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition">
      Reset
    </button>
  </div>

  <button
    onClick={startDeploy}
    className="px-5 py-2 text-sm font-medium text-gray-200 border border-gray-700 bg-gray-800/40 rounded-md hover:bg-gray-700 hover:text-white transition"
  >
    Deploy Strategy
  </button>
</div>

{/* Deploy Modal */}
{isDeploying && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
    <div className="bg-gray-900 p-6 rounded-xl w-96 shadow-lg border border-cyan-500/30">
      <h2 className="text-lg font-semibold mb-3 text-cyan-300">Deploying Strategy</h2>

      <div className="w-full bg-gray-800 rounded h-3 mb-3">
        <div
          className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-3 rounded"
          style={{ width: `${deployProgress}%`, transition: 'width 400ms linear' }}
        />
      </div>
      <div className="text-sm text-gray-300 mb-4">{deployProgress}%</div>

  <div ref={logsContainerRef} className="bg-black/40 rounded p-3 h-40 overflow-auto text-sm text-gray-200">
        {deployLogs.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20" fill="none" />
              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
            Starting...
          </div>
        ) : (
          deployLogs.map((l, i) => <div key={i} className="mb-1">{l}</div>)
        )}
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={cancelDeploy}
          className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            // if finished allow close, otherwise cancel
            if (deployProgress >= 100) setIsDeploying(false);
            else cancelDeploy();
          }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold"
        >
          {deployProgress >= 100 ? 'Close' : 'Close & Stop'}
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
