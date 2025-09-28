import { useState } from "react";
import { Menu } from "lucide-react";
import ProtocolsPanel from "./panels/ProtocolPannel";
import PaymentsPanel from "./panels/PaymentsPanel";
import ConfigPanel from "./panels/ConfigPannel";

export default function Sidebar({ addNode, selectedNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<"protocols" | "payments" | "config">("protocols");

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed top-[60px] right-0 h-[calc(100vh-60px)] transition-transform duration-300
        ${isOpen ? "translate-x-0" : "translate-x-full"}
        w-64 bg-gradient-to-b from-gray-900/70 to-gray-800/60 backdrop-blur-xl border-l border-gray-700/40 shadow-lg`}
      >
        {/* Tabs */}
        <div className="flex justify-around border-b border-gray-700/40 text-xs text-gray-400">
          <SidebarTab label="Protocols" active={tab === "protocols"} onClick={() => setTab("protocols")} />
          <SidebarTab label="Payments" active={tab === "payments"} onClick={() => setTab("payments")} />
          <SidebarTab label="Config" active={tab === "config"} onClick={() => setTab("config")} />
        </div>

        {/* Panels */}
        <div className="p-3 overflow-y-auto h-[calc(100%-40px)] text-sm text-gray-200">
          {tab === "protocols" && <ProtocolsPanel addNode={addNode} />}
          {tab === "payments" && <PaymentsPanel addNode={addNode} />}
          {tab === "config" && <ConfigPanel selectedNode={selectedNode} />}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="absolute top-6 right-6 z-50 p-1.5 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-gray-200 hover:bg-white/20 transition"
      >
        <Menu size={16} />
      </button>
    </>
  );
}

function SidebarTab({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 transition text-xs tracking-wide ${
        active
          ? "text-white border-b-2 border-cyan-400"
          : "hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
