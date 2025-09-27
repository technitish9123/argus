import React from "react";

interface FloatingControlsProps {
  deleteNode: () => void;
  resetCanvas: () => void;
  selectedNode: any; // can refine to ReactFlow Node type
}

export default function FloatingControls({
  deleteNode,
  resetCanvas,
  selectedNode,
}: FloatingControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 flex gap-3">
      {selectedNode && (
        <button
          onClick={deleteNode}
          className="px-3 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-red-400 hover:text-red-300 hover:bg-white/20 transition text-sm shadow-md"
        >
          🗑
        </button>
      )}
      <button
        onClick={resetCanvas}
        className="px-3 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-cyan-400 hover:text-cyan-300 hover:bg-white/20 transition text-sm shadow-md"
      >
        🔄
      </button>
    </div>
  );
}
