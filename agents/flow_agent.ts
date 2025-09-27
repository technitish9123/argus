import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import elliptic from "elliptic";
import fetch from "node-fetch"; // npm install node-fetch

// ------------------ CONFIG ------------------
fcl.config().put("accessNode.api", "https://rest-testnet.onflow.org");

// Your Flow testnet credentials
const SERVICE_ADDRESS = "0xe7a9c9eb8d5cc433"; // testnet address
const PRIVATE_KEY = "f525f1afbc006137e9595c6559031e9bf31fdeb3646485d3b6c5d6ddfe7b353f";
const KEY_INDEX = 0;

// Elliptic for signing
const ec = new elliptic.ec("p256");

// Service account authorization function (fixed signature format)
const authorization = async (account: any = {}) => {
  return {
    ...account,
    addr: fcl.sansPrefix(SERVICE_ADDRESS),
    keyId: KEY_INDEX,
    signingFunction: async (signable: any) => {
      const key = ec.keyFromPrivate(Buffer.from(PRIVATE_KEY, "hex"));
      const sig = key.sign(Buffer.from(signable.message, "hex"));

      // Ensure fixed 32-byte R and S
      const r = sig.r.toArrayLike(Buffer, "be", 32);
      const s = sig.s.toArrayLike(Buffer, "be", 32);
      const signatureHex = Buffer.concat([r, s]).toString("hex");

      return {
        addr: fcl.withPrefix(SERVICE_ADDRESS),
        keyId: KEY_INDEX,
        signature: signatureHex,
      };
    },
  };
};


// ------------------ UTILS ------------------
async function waitForSeal(txId: string) {
  console.log(`[Flow] Waiting for seal of tx=${txId}`);
  const sealed = await fcl.tx(txId).onceSealed();
  console.log(`[Flow] Transaction ${txId} sealed. Status=${sealed.status}`);
  return sealed;
}


// ------------------ STRATEGY ------------------
async function runComplexStrategy() {

  const baseAmount = "100.0";
  const leverage = "2";

  console.log(`[Agent] Running with base=${baseAmount} leverage=${leverage}`);

  // Example dummy tx
  const borrowTxId = await fcl.mutate({
    cadence: `
      transaction(amount: UFix64, leverage: UInt64) {
        prepare(acct: AuthAccount) {
          log("Borrowing with leverage")
        }
      }
    `,
    args: (arg) => [arg(baseAmount, t.UFix64), arg(leverage, t.UInt64)],
    proposer: authorization,
    payer: authorization,
    authorizations: [authorization],
    limit: 100,
  });

  console.log("Borrow submitted:", borrowTxId);
  await waitForSeal(borrowTxId);
}

runComplexStrategy().catch(console.error);
