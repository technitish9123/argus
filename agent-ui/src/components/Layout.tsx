import { Link } from "react-router-dom";
import Logo from "./Logo";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (eventName: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (eventName: string, handler: (...args: unknown[]) => void) => void;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  useEffect(() => {
  const eth = window.ethereum as EIP1193Provider | undefined;
    if (!eth) return;
    // initialize from localStorage so UI persists connected user across reloads
    const existing = localStorage.getItem("userId");
    if (existing) setAddress(existing);
    const handleAccounts = (accounts: string[]) => {
      setAddress(accounts && accounts.length ? accounts[0] : null);
    };
    const handleChain = (c: string) => setChainId(c);

    // helper to call and coerce unknown -> expected types
    eth.request({ method: "eth_accounts" })
      .then((v) => handleAccounts((v as unknown) as string[]))
      .catch(() => {});
    eth.request({ method: "eth_chainId" })
      .then((v) => handleChain((v as unknown) as string))
      .catch(() => {});

    const onAccounts = (...args: unknown[]) => handleAccounts((args[0] as unknown) as string[]);
    const onChain = (...args: unknown[]) => handleChain((args[0] as unknown) as string);

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const short = (a: string | null) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "Not connected");

  const connect = async () => {
    const eth = window.ethereum as EIP1193Provider | undefined;
    if (!eth) return alert("No injected wallet found (MetaMask). Connect an RPC or use a browser wallet.");
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accs[0] ?? null;
  setAddress(addr);
  if (addr) localStorage.setItem("userId", addr);
      const c = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(c ?? null);
    } catch (e) {
      console.error("Wallet connect failed", e);
    }
  };

  const disconnect = () => {
    setAddress(null);
    // wallets don't support programmatic disconnect widely; we just clear local state
    localStorage.removeItem("userId");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              to="/"
              className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent"
            >
              <Logo />
            </Link>

          <div className="space-x-6 flex items-center">
            <Link to="/strategies" className="hover:text-cyan-400 transition">Strategies</Link>
            <Link to="/playground" className="hover:text-cyan-400 transition">Playground</Link>
            <Link to="/dashboard" className="hover:text-cyan-400 transition">Dashboard</Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-300 hidden sm:block">{chainId ? `Chain: ${chainId}` : "No chain"}</div>
            <div className="text-sm font-mono text-gray-200">{short(address)}</div>
            {!address ? (
              <button onClick={connect} className="px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500 text-sm">Connect</button>
            ) : (
              <button onClick={disconnect} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm">Disconnect</button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950/70 backdrop-blur mt-10">
        <div className="max-w-7xl mx-auto px-6 py-4 text-sm text-gray-400 flex justify-between">
          <p>© {new Date().getFullYear()} DeFi Agent. All rights reserved.</p>
          <p>Built for Web3 users 🚀</p>
        </div>
      </footer>
    </div>
  );
}
