# Agent Protocol DSL

A TypeScript-based DSL for agent protocol flows, including schema-driven intent execution and LLM-powered planning.

## Project Structure

- `src/` — Core source code
- `examples/` — Usage examples and demos
- `schemas/` — JSON schemas for supported protocols/actions
- `spec/` — DSL specification
- `tests/` — Unit and integration tests
- `docs/` — Documentation and guides
- `.github/` — GitHub workflows and instructions

# Agent Protocol DSL

A TypeScript-based DSL for agent protocol flows, including schema-driven intent execution and LLM-powered planning.

---

## Folder Structure

```text
src/         # Core source code (business logic, types, validators, execution)
examples/    # Usage examples and demos
schemas/     # JSON schemas for supported protocols/actions
spec/        # DSL specification
tests/       # Unit and integration tests
docs/        # Documentation and guides
.github/     # GitHub workflows and instructions
.vscode/     # VSCode workspace settings
scripts/     # Utility scripts
```

---

## Getting Started

1. **Install dependencies:**
   ```sh
   pnpm install
   ```
2. **Build the project:**
   ```sh
   pnpm build
   ```
3. **Run examples:**
   ```sh
   pnpm tsx examples/lido-stake-llm.ts
   ```

---

## Example: Uniswap V3 exactInputSingle

```ts
// This is a demo script for executing a Uniswap V3 swap using a schema and inputs.
// Business logic is unchanged; only comments and structure are improved.

async function main() {
  const rpc = process.env.RPC_URL!;
  const pk = process.env.PRIVATE_KEY!;
  if (!rpc || !pk) throw new Error("Set RPC_URL and PRIVATE_KEY");

  // Load schema file and convert to file URL
  const schemaFs = path.join(
    process.cwd(),
    "schemas/uniswap_v3/actions/exactInputSingle.json"
  );
  const schemaUrl = pathToFileURL(schemaFs).href;

  // Prepare swap inputs
  const now = Math.floor(Date.now() / 1000);
  const inputs = {
    tokenIn: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), // USDC
    tokenOut: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), // WETH
    fee: 3000,
    recipient: getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
    deadline: now + 1200,
    amountIn: "5000000", // 5 USDC (6 dp)
    amountOutMinimum: "0", // demo only; add slippage guard in prod
    sqrtPriceLimitX96: "0",
  };

  // Execute the swap (simulateOnly: false)
  const result = await execFromFile(schemaUrl, inputs, rpc, pk, false);
  console.log("Tx result:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> You can run in **simulate mode** by passing `true` as the last argument:
> `await execFromFile(schemaUrl, inputs, rpc, pk, true)`

---

## Environment Variables

- `RPC_URL` — Ethereum RPC endpoint (Infura/Alchemy/local fork)
- `PRIVATE_KEY` — Private key for the signer (use test keys on forks)

---

## TypeScript / ESM Notes

This package targets **NodeNext ESM**. In your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

- When using relative imports in your own source, include the **`.js`** extension (NodeNext rule).
- JSON imports use: `import x from "file.json" with { type: "json" }`.

---

## Contributing

- Fork the repo, create a branch, and submit PRs.
- See `docs/ROADMAP.md` for future plans.

---

## License

MIT
