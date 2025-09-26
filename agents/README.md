# Agents

Quick helpers to run agent example scripts for development and testing.

Run an agent script using the workspace helper (loads `.env` via dotenv):

```bash
# from repo root
pnpm run agent -- agents/pyusd_payment.ts
```

Or run with tsx directly (if you have it installed):

```bash
pnpm dlx tsx -r dotenv/config agents/pyusd_payment.ts
```

Set environment variables in `.env` or copy `.env.example`.
