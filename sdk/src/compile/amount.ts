import { parseUnits } from "ethers";

export function toWei(
  amount: any,
  token: {
    address: `0x${string}`;
    decimals: number;
  },
  balanceWei?: bigint
): bigint {
  switch (amount.kind) {
    case "wei":
      return BigInt(amount.value);
    case "ether":
      return BigInt(parseUnits(String(amount.value), 18).toString());
    case "units": {
      const d = amount.decimals ?? token.decimals;
      return BigInt(parseUnits(String(amount.value), d).toString());
    }
    case "percent_of_balance": {
      if (balanceWei == null) throw new Error("percent_of_balance requires balance");
      const v = Number(amount.value);
      // Accept either fraction (0.1 => 10%) or percent (10 => 10%)
      const basisPoints = v <= 1 ? Math.round(v * 10_000) : Math.round(v * 100);
      return (balanceWei * BigInt(basisPoints)) / 10_000n;
    }
    default:
      throw new Error(`Unknown amount kind: ${amount.kind}`);
  }
}
