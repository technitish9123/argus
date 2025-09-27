import { motion } from "framer-motion";
import { Typewriter } from "react-simple-typewriter";
import Lottie from "lottie-react";
import Tilt from "react-parallax-tilt";
import robotAnim from "../assets/robot.json";

// Logos (using <img /> so it works reliably)
import AaveIcon from "../logos/aave.svg";
import UniswapIcon from "../logos/uniswap.svg";
import CurveIcon from "../logos/curve.svg";
import CompoundIcon from "../logos/compound.svg";

export default function LandingPage() {
  const protocols = [
    {
      name: "Aave",
      desc: "Supply, borrow, repay, and withdraw with optimized risk models.",
      strategies: ["Supply Stablecoins", "Leverage ETH", "Yield Farming"],
      icon: AaveIcon,
    },
    {
      name: "Uniswap",
      desc: "AMM strategies for swaps and liquidity provisioning.",
      strategies: ["Custom Tick LP", "Volatility Farming", "DEX Arbitrage"],
      icon: UniswapIcon,
    },
    {
      name: "Curve",
      desc: "Stablecoin and staked assets optimized pools.",
      strategies: ["Stablecoin Yield", "LSD Arbitrage", "Pool Rebalancing"],
      icon: CurveIcon,
    },
    {
      name: "Compound",
      desc: "Lending/borrowing with governance integrations.",
      strategies: ["Passive Lending", "Recursive Borrowing"],
      icon: CompoundIcon,
    },
  ];

  return (
    <div
      className="min-h-screen text-white flex flex-col relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-black"
     
    >
      {/* Hero */}
      <section className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12 px-6 py-20 relative z-10">
        <div className="text-center md:text-left max-w-2xl">
          <h2 className="text-5xl md:text-6xl font-extrabold mb-6">
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              <Typewriter
                words={[
                  "The DeFi Agent Framework",
                  "Automated Liquidity Management",
                  "Risk-Aware Yield Farming",
                ]}
                loop={0}
                cursor
                cursorStyle="|"
                typeSpeed={70}
                deleteSpeed={50}
                delaySpeed={2000}
              />
            </span>
          </h2>
          <p className="text-gray-300 mb-8">
            Build, test, and deploy autonomous DeFi agents. From liquidity
            management to risk-adjusted strategies — powered by a modular
            TypeScript + React stack.
          </p>
          <button className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition">
            🚀 Get Started
          </button>
        </div>

        {/* Floating Robot */}
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-72 h-72"
        >
          <Lottie animationData={robotAnim} loop />
        </motion.div>
      </section>

      {/* Code Snippet */}
      <section className="px-6 md:px-20 py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="relative max-w-3xl mx-auto rounded-xl border border-cyan-400/20 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-md shadow-xl overflow-hidden"
        >
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gray-700">
            <span className="text-xs text-gray-400">example.ts</span>
            <button
              onClick={() =>
                navigator.clipboard.writeText(`import { Agent } from "defi-agent";

const agent = new Agent({
  name: "Yield Farmer",
  protocols: ["Aave", "Uniswap"],
  strategy: "Leverage LP",
  risk: "Medium",
  params: { leverage: 3, tickRange: 1.5 }
});

agent.deploy();`)
              }
              className="text-xs text-gray-400 hover:text-cyan-400 transition"
            >
              Copy
            </button>
          </div>

          {/* Code Body */}
          <pre className="p-6 text-sm font-mono leading-relaxed text-gray-200">
            <code>
              <Typewriter
                words={[
                  `import { Agent } from "defi-agent";

const agent = new Agent({
  name: "Yield Farmer",
  protocols: ["Aave", "Uniswap"],
  strategy: "Leverage LP",
  risk: "Medium",
  params: { leverage: 3, tickRange: 1.5 }
});

agent.deploy();`,
                ]}
                cursor
                cursorStyle="▌"
                typeSpeed={30}
                deleteSpeed={999999}
              />
            </code>
          </pre>
        </motion.div>
      </section>

      {/* Supported Protocols */}
      <section className="px-6 md:px-20 py-20 relative z-10">
        <h3 className="text-3xl font-bold text-center mb-12">
          Supported Protocols
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {protocols.map((p) => (
            <Tilt key={p.name} tiltMaxAngleX={10} tiltMaxAngleY={10} scale={1.05}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="p-6 rounded-xl border border-cyan-500/20 bg-white/5 backdrop-blur-md shadow-lg hover:shadow-cyan-500/30 transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={p.icon} alt={p.name} className="w-6 h-6" />
                  <h4 className="text-xl font-semibold">{p.name}</h4>
                </div>
                <p className="text-gray-300 mb-4">{p.desc}</p>
                <ul className="text-sm text-gray-200 space-y-1">
                  {p.strategies.map((strategy) => (
                    <li key={strategy}>• {strategy}</li>
                  ))}
                </ul>
              </motion.div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* Why Section */}
      <section className="px-6 md:px-20 py-20 relative z-10 text-center">
        <h3 className="text-3xl font-bold mb-8">Why DeFi Agents?</h3>
        <p className="max-w-3xl mx-auto text-gray-300 text-lg">
          Today, yield farming and liquidity provisioning require constant
          monitoring, manual strategy updates, and risk management. <br />
          <span className="text-cyan-400 font-semibold">DeFi Agents</span> automate
          this process — deploying capital across protocols with AI-driven
          decision-making and risk-adjusted execution.
        </p>
      </section>

      {/* How It Works Section */}
      <section className="px-6 md:px-20 py-20 relative z-10">
        <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          {[
            { step: "AI Agent", desc: "Learns market signals and strategy patterns." },
            { step: "Strategy", desc: "Defines LP, lending, or arbitrage positions." },
            { step: "Protocol", desc: "Executes across Aave, Uniswap, Curve, Compound." },
            { step: "Yield", desc: "Optimizes returns with minimized risk." },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.2 }}
              className="p-6 rounded-xl border border-cyan-500/20 bg-white/5 backdrop-blur-md shadow-lg"
            >
              <h4 className="text-xl font-semibold text-cyan-400 mb-2">
                {item.step}
              </h4>
              <p className="text-gray-300 text-sm">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Vision Section */}
      <section className="px-6 md:px-20 py-20 relative z-10 text-center">
        <h3 className="text-3xl font-bold mb-8">Our Vision</h3>
        <p className="max-w-3xl mx-auto text-gray-300 text-lg">
          We’re building the{" "}
          <span className="text-indigo-400 font-semibold">AI Agent Layer</span> for
          Web3 — enabling autonomous strategies, cross-chain liquidity deployment, and
          real-time risk monitoring. <br />
          Think of it as{" "}
          <span className="text-cyan-400">Autopilot for DeFi</span>.
        </p>
      </section>
    </div>
  );
}
