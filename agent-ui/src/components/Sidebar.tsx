import { useState } from "react";
import { Menu } from "lucide-react";
import ProtocolsPanel from "./panels/ProtocolPannel";
import PaymentsPanel from "./panels/PaymentsPanel";
import ConfigPanel from "./panels//ConfigPannel";

export default function Sidebar({ addNode, selectedNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<"protocols" | "payments" | "config">("protocols");

  return (
    <>
      <div
        className={`fixed top-[60px] right-0 h-[calc(100vh-60px)] transition-transform duration-300
        ${isOpen ? "translate-x-0" : "translate-x-full"}
        w-72 bg-white/10 backdrop-blur-md border-l border-white/20 shadow-lg`}
      >
        <div className="flex justify-around border-b border-white/20">
          <button onClick={() => setTab("protocols")} className="px-4 py-2">Protocols</button>
          <button onClick={() => setTab("payments")} className="px-4 py-2">Payments</button>
          <button onClick={() => setTab("config")} className="px-4 py-2">Config</button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-40px)]">
          {tab === "protocols" && <ProtocolsPanel addNode={addNode} />}
          {tab === "payments" && <PaymentsPanel addNode={addNode} />}
          {tab === "config" && <ConfigPanel selectedNode={selectedNode} />}
        </div>
      </div>

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="absolute top-6 right-6 z-50 p-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition"
      >
        <Menu size={20} />
      </button>
    </>
  );
}
