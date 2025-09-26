// examples/registry.ts
import type { AddressRegistry } from "../src/ports.js";

export const MainnetRegistry: AddressRegistry = {
  getContract(protocol: string, role: string, chainId: number) {
    if (chainId !== 1) throw new Error("Only chainId 1 in example");
    const p = protocol.toLowerCase();
    const r = role.toLowerCase();

    if (p === "uniswap_v3" && r === "router")
      return "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    if (p === "uniswap_v3" && r === "quoter")
      return "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";

    if (p === "aave_v3" && r === "pool")
      return "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

    if (p === "lido" && r === "steth")
      return "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
    if (p === "lido" && r === "wsteth")
      return "0x7f39c581F595B53c5cb19BD0b3f8dA6c935E2Ca0";

    if (p === "etherfi" && r === "liquiditypool")
      return "0x308861A430be4cce5502d0A12724771Fc6DaF216";
    if (p === "etherfi" && r === "weeth")
      return "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee";

    throw new Error(`Unknown protocol/role: ${protocol}/${role}`);
  },

  getToken(symbol: string, chainId: number) {
    if (chainId !== 1) throw new Error("Only chainId 1 in example");
    const s = symbol.toUpperCase();
    if (s === "WETH" || s === "weth")
      return {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
      };
    if (s === "USDC" || s === "usdc")
      return {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
      };
    if (s === "STETH" || s === "steth")
      return {
        address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
        decimals: 18,
      };
    if (s === "WSTETH" || s === "wsteth")
      return {
        address: "0x7f39c581F595B53c5cb19BD0b3f8dA6c935E2Ca0",
        decimals: 18,
      };
    if (s === "WEETH" || s === "weeth")
      return {
        address: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
        decimals: 18,
      };
    if (s === "EETH" || s === "eeth")
      return {
        address: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
        decimals: 18,
      };
    if (s === "PYUSD" || s === "pyusd")
      return {
        address: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9", // testnet address
        decimals: 6,
      };
    throw new Error(`Unknown token: ${symbol}`);
  },
};
