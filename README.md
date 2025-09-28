
# 🛡️ Argus — DeFi Agent Protocol DSL

**Argus** is an open-source framework for building, testing, and deploying **autonomous DeFi agents**.
It combines a **DSL (Domain-Specific Language)**, **runtime SDK**, and **management backend** to make DeFi strategies composable, verifiable, and easy to run.

---

## ✨ Why Argus?

DeFi today is fragmented:

* Developers must wire together ABIs, SDKs, and brittle scripts.
* Strategies are opaque — hard to reason about or reuse.
* Running agents at scale requires custom infra.

**Argus solves this** with three layers:

1. **SDK (`@apdsl/agent-kit`)**

   * A strongly typed DSL to describe intents (`borrow`, `swap`, `stake`, …).
   * Compiles intents into IR → onchain actions.
   * Built-in validators, ABI registry, and TA signals.

2. **Agents**

   * Example strategies like `leverage_loop`, `pyusd_subscription`, `trading_agent`.
   * Parametrizable & reproducible — one agent, many variations.

3. **Backend + UI**

   * Run Manager: create, fund, and monitor agent runs.
   * JSON-backed persistence (lightweight, no infra lock-in).
   * Sleek React dashboard to deploy, manage, and fund agents in real-time.

---

## 🚀 Features

* 🧑‍💻 **Developer-first SDK** — build agents in TypeScript.
* 🔗 **Protocol integrations** — Aave, Uniswap, Curve, Compound, Lido, Sovryn, etc.
* ⚡ **Streaming logs** — SSE-powered live monitoring.
* 🛠️ **Local-first** — works on `localhost` with minimal setup.
* 🔒 **Composable & safe** — schema-validated strategies.
* 🎨 **Clean UI** — glassy dashboard to design, deploy, and backtest agents.

---

## 📂 Project Structure

```

agent-protocol-dsl/
├── sdk/               # Core SDK (@apdsl/agent-kit)
├── agents/            # Example agents
│   ├── leverage_loop.ts
│   ├── pyusd_subscription.ts
│   ├── trading_agent.ts
│   └── ...
├── backend/           # Run Manager API
├── frontend/          # React playground dashboard
└── package.json

````

---

## 🏗️ Getting Started

```bash
git clone https://github.com/technitish9123/argus
cd argus
pnpm install
````

Run backend:

```bash
cd backend
pnpm dev
```

Run frontend:

```bash
cd frontend
pnpm dev
```

Visit 👉 `http://localhost:5173`

Try an agent:

```bash
npx tsx agents/leverage_loop.ts
```

---

## 🖥️ UI Preview

* **Dashboard** — deployed agents & live runs.
* **Strategies Page** — browse available strategies with metadata (risk, yield, cost).
* **Deploy Page** — configure params, fund, and launch agents.
* **Playground** — drag & drop DSL node editor for building workflows.

---

## 🛠️ Tech Stack

* **TypeScript** — SDK + agents
* **Express** — backend API
* **React + Tailwind** — frontend dashboard
* **EVM + Flow + Rootstock** — blockchain backends
* **SSE** — live run streaming

---

## 🔮 Roadmap

* [ ] Cross-chain intent support
* [ ] Real yield & risk analytics
* [ ] Guardian-controlled agent wallets
* [ ] Agent marketplace (share & fork strategies)

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

---

## 📜 License

MIT © 2025 Argus contributors

---

# 🏆 Hackathon Tracks

## 🪙 Argus on **Rootstock**

* **Composable Automation**: Build & deploy automated DeFi agents on Rootstock (e.g., Sovryn leverage loops).
* **Cross-Protocol Strategies**: Chain Rootstock-native protocols with Ethereum-style workflows.
* **Ecosystem Growth**: Lower barrier for building automated risk managers, market makers, and consumer apps.

✅ Qualifies for: **Freestyle Track**

### 📜 Rootstock Contract Deployment

* **Contract Deployed:** `AgentExecutor.sol`
* **Deployed Address:** [`0xEb00Fa0dD4089Cc1ae7177ef57dc4e03B64f89a4`](https://explorer.testnet.rootstock.io/address/0xEb00Fa0dD4089Cc1ae7177ef57dc4e03B64f89a4)
* **Deployer Address:** `0x08Cb58C5F9Eff674ac10aFfF7393f14fCbb53A10`

#### Transactions

1. **Deploy** → [0xc233aa1c65a11fc783d8a34bfb7c417f041158714e5f2968d34a92ed3aeb7d05](https://explorer.testnet.rootstock.io/tx/0xc233aa1c65a11fc783d8a34bfb7c417f041158714e5f2968d34a92ed3aeb7d05)
2. **Deposit** (0.0001 RBTC) → [0x552a54d3f8e28f73a81269d012b21c18722b5ba90718812bc1d00060f60e736a](https://explorer.testnet.rootstock.io/tx/0x552a54d3f8e28f73a81269d012b21c18722b5ba90718812bc1d00060f60e736a)
3. **Borrow** (mock) → [0x975f908db656a637b9b10f126a02690d88e5bdb057cebf1b21dc214f4de959e1](https://explorer.testnet.rootstock.io/tx/0x975f908db656a637b9b10f126a02690d88e5bdb057cebf1b21dc214f4de959e1)

These transactions qualify our project for the **Rootstock Freestyle Track**.

---

## 💵 Argus with **PayPal USD (PYUSD)**

* **Subscription Agent**: Demo agent that auto-swaps token ETH → PYUSD and pays recurring subscriptions/supplychain.
* **Stable Utility**: Showcases real consumer UX: streaming payments, micro-subscriptions, automated top-ups.
* **Interoperable**: Works with any DeFi protocol that supports ERC-20 stablecoins.

✅ Qualifies for: **Best PayPal USD use case**

---

## 🌊 Argus on **Flow**

* **Flow EVM Support**: Agents run seamlessly on Flow’s EVM runtime (Solidity strategies ported instantly).
* **Flow Actions (FLIP-338)**: DSL compiles to Flow Actions = standardized, composable workflows (no raw ABI wiring).
* **Consumer-Grade UX**: Agents enable subscription models, AI-driven DeFi, and game-native financial actions.

✅ Qualifies for:

* **Best Automation & Actions (FLIP-338)**

---

**Argus = one DSL, many blockchains, automated DeFi everywhere.**
