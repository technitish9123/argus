import * as fcl from "@onflow/fcl";

// Example: Flow API-Driven Strategy
// This agent fetches external signals (e.g., price, yield, oracles) from an API and acts on Flow accordingly.

async function fetchSignalFromAPI(): Promise<{ action: string; amount: number }> {
  // Replace with your API endpoint and logic
  // Example: fetch trading signal from a REST API
  const response = await fetch("https://api.example.com/flow-signal");
  if (!response.ok) throw new Error("Failed to fetch signal");
  return response.json();
}

async function runApiDrivenStrategy() {
  try {
    const signal = await fetchSignalFromAPI();
    console.log("Received signal:", signal);

    if (signal.action === "swap") {
      const txId = await fcl.mutate({
        cadence: `import SwapAction from 0xSwapAction
          transaction(amount: UFix64) {
            prepare(acct: AuthAccount) {
              SwapAction.swap(acct, amount)
            }
          }`,
        args: (arg: any, t: any) => [arg(signal.amount.toString(), t.UFix64)],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 100,
      });
      console.log("Swap submitted:", txId);
    } else if (signal.action === "lend") {
      const txId = await fcl.mutate({
        cadence: `import LendAction from 0xLendAction
          transaction(amount: UFix64) {
            prepare(acct: AuthAccount) {
              LendAction.lend(acct, amount)
            }
          }`,
        args: (arg: any, t: any) => [arg(signal.amount.toString(), t.UFix64)],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 100,
      });
      console.log("Lend submitted:", txId);
    } else {
      console.log("No action taken for signal:", signal.action);
    }
  } catch (err) {
    console.error("API-driven strategy error:", err);
  }
}

runApiDrivenStrategy();
