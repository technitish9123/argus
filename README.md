

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
   * Comes with built-in validators, ABI registry, and TA signals.

2. **Agents**

   * Example strategies like `leverage_loop`, `lido-stake`, `trading_agent`.
   * Parametrizable & reproducible — one agent, many variations.

3. **Backend + UI**

   * Run Manager: create, fund, and monitor agent runs.
   * JSON-backed persistence (lightweight, no infra lock-in).
   * Sleek React dashboard to deploy, manage, and fund agents in real-time.

---

## 🚀 Features

* 🧑‍💻 **Developer-first SDK** — build new agents with TypeScript.
* 🔗 **Protocol integrations** — Aave, Uniswap, Lido, and more (via ABI registry).
* ⚡ **Streaming logs** — SSE-powered live run monitoring.
* 🛠️ **Local-first** — works on `localhost` with minimal setup.
* 🔒 **Composable & safe** — strong schema validation of strategies.
* 🎨 **Clean UI** — glassy dashboard to view & deploy your agents.

---

## 📂 Project Structure

```
agent-protocol-dsl/
├── sdk/               # Core SDK (@apdsl/agent-kit)
│   ├── src/           # DSL compiler, runtime, signals, utils
│   ├── spec/          # JSON Schemas for DSL
│   └── tests/         # Unit & integration tests
│
├── agents/            # Example agents built on SDK
│   ├── leverage_loop.ts
│   ├── trading_agent.ts
│   ├── lido-stake.ts
│   └── ...
│
├── backend/           # Run Manager API
│   ├── src/           # Routes, services, storage
│   └── package.json
│
├── frontend/          # React playground dashboard
│   ├── src/pages      # Dashboard, Deploy, Strategies
│   └── src/components # Forms, Logs, Controls
│
└── package.json       # Monorepo root
```

---

## 🏗️ Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-org/argus
cd argus
pnpm install
```

### 2. Run Backend

```bash
cd backend
pnpm dev
```

### 3. Run Frontend

```bash
cd frontend
pnpm dev
```

Visit 👉 `http://localhost:5173`

### 4. Try Example Agent

```bash
npx tsx agents/leverage_loop.ts
```

---

## 🖥️ UI Preview

* **Dashboard** — see all your deployed agents, runs, and statuses.
* **Strategies Page** — browse available DeFi strategies with risk, yield, and cost info.
* **Deploy Page** — configure params, fund, and launch an agent.

---

## 🛠️ Tech Stack

* **TypeScript** — SDK + agents
* **Express** — backend API
* **React + Tailwind** — frontend dashboard
* **Flow / EVM** — blockchain networks (extensible)
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