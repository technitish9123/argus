// src/multi.ts
import 'dotenv/config';
import { executeIntent } from '@apdsl/agent-kit';
import ollamaLLM from './ollamaLLM';

type RunOpts = {
  rpcUrl: string;
  privateKey: string;
  chainIdDefault?: number;
  debug?: boolean;
};

function req(v: unknown, name: string): asserts v {
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing ${name}. Set it in .env or pass via CLI.`);
  }
}

// ── ENV / CLI ──────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CHAIN_ID = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined;
const DEBUG = process.env.DEBUG?.toLowerCase() === 'true';

req(RPC_URL, 'RPC_URL');
req(PRIVATE_KEY, 'PRIVATE_KEY');

const argv = process.argv.slice(2);

// Simple CLI parsing: --intent "...", --chain 1, --debug
let cliIntent: string | undefined;
let cliChainId: number | undefined;
let cliDebug: boolean | undefined;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--intent' && argv[i + 1]) {
    cliIntent = argv[++i];
  } else if (a === '--chain' && argv[i + 1]) {
    cliChainId = Number(argv[++i]);
  } else if (a === '--debug') {
    cliDebug = true;
  }
}

const chainIdDefault = cliChainId ?? CHAIN_ID ?? 1;
const isDebug = cliDebug ?? DEBUG ?? false;

// ── Intent List (edit/fork freely) ─────────────────────────────────────────────
const defaultIntents: string[] = [
  // 1) Simple swap (sanity check)
  'Swap 10 WETH to USDC with 0.5% slippage on the 0.3% pool',

  // 2) EtherFi restake + Aave borrow (multi-protocol)
  // 'Restake 1 ETH via EtherFi, then deposit all weETH to Aave as collateral and borrow 250 USDC at variable rate',

  // 3) Leveraged loop (fixed iterations)
  // 'Do a 3x leverage loop: supply 0.5 WETH to Aave as collateral, borrow USDC, swap USDC to WETH on 0.3% fee pool with 0.5% slippage, and resupply WETH each loop',

  // 4) Guarded deleverage plan (uses repay/withdraw with sequencing)
  // 'Deleverage position: swap enough WETH to get 200 USDC, repay 200 USDC variable debt on Aave, then withdraw 0.1 WETH collateral'
];

const intents: string[] = cliIntent ? [cliIntent] : defaultIntents;

// ── Helpers ───────────────────────────────────────────────────────────────────
const short = (x?: string | null, n = 6) =>
  x && x.startsWith('0x') ? `${x.slice(0, 2 + n)}…${x.slice(-n)}` : x ?? '';

const labelFor = (dslUrl: string) => {
  try {
    const parts = dslUrl.split('/').filter(Boolean);
    return parts.slice(-3).join('/');
  } catch {
    return dslUrl;
  }
};

const isApprovalStep = (dslUrl: string) =>
  /erc20\/approve/i.test(dslUrl) || /approve\.json$/i.test(dslUrl);

// ── Runner ────────────────────────────────────────────────────────────────────
async function runIntent(intent: string, opts: RunOpts) {
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('→ Intent:', intent);
  console.log(
    `  chainId=${opts.chainIdDefault ?? 1} debug=${!!opts.debug} rpc=${opts.rpcUrl}`
  );

  try {
    const start = Date.now();
    const res: any = await executeIntent(intent, {
      rpcUrl: opts.rpcUrl,
      privateKey: opts.privateKey,
      chainIdDefault: opts.chainIdDefault ?? 1,
      autoInsertApprovals: true,
      debug: !!opts.debug
    });
    const ms = Date.now() - start;

    // High-level summary
    console.log('Caller:', res?.caller ?? '(unknown)');
    console.log('Planned steps:', res?.plannedSteps?.length ?? 0);
    console.log('Executed steps (incl. approvals):', res?.executedSteps?.length ?? 0);

    const txResults: any[] = Array.isArray(res?.txResults) ? res.txResults : [];
    if (txResults.length === 0) {
      console.log('No txResults returned (nothing to execute or simulation only).');
    } else {
      console.log('Tx results:');
      for (const r of txResults) {
        const tag = r?.error ? 'error' : 'success';
        const label = r?.dslUrl ? labelFor(r.dslUrl) : '(unknown dslUrl)';
        const maybeApproval = r?.dslUrl && isApprovalStep(r.dslUrl) ? ' [approval]' : '';
        const idx = typeof r?.index === 'number' ? r.index : -1;
        console.log(
          `  [${String(idx).padStart(2, '0')}] ${tag}${maybeApproval} ${label} ${short(
            r?.txHash
          )}`
        );
        if (r?.error) {
          console.log('      ↳', r.error?.message ?? r.error);
        }
        if (r?.simulation) {
          const minOut = r.simulation?.minOut ?? r.simulation?.min_out;
          const gasEst = r.simulation?.gas ?? r.simulation?.gas_estimate;
          if (minOut || gasEst) {
            console.log(
              `      sim: ${minOut ? `minOut=${minOut} ` : ''}${
                gasEst ? `gas≈${gasEst}` : ''
              }`
            );
          }
        }
      }
    }

    const failed = txResults.some((r) => r?.error);
    console.log(`Result: ${failed ? 'PARTIAL / FAILED' : 'SUCCESS'} (${ms} ms)`);
  } catch (err: any) {
    console.error('Fatal error executing intent:', err?.stack ?? err?.message ?? err);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  for (const intent of intents) {
    await runIntent(intent, {
      rpcUrl: RPC_URL as string,
      privateKey: PRIVATE_KEY as string,
      chainIdDefault,
      debug: isDebug
    });
  }
}

main().catch((e) => {
  console.error('Uncaught:', e);
  process.exit(1);
});
