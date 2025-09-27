import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Layout({ children }: { children: React.ReactNode }) {
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

          <div className="space-x-6">
            <Link to="/strategies" className="hover:text-cyan-400 transition">Strategies</Link>
            <Link to="/playground" className="hover:text-cyan-400 transition">Playground</Link>
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
