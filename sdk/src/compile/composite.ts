import type { AddressRegistry, ChainId } from "../ports.js";

export function makeCompositeRegistry(
  a: Pick<AddressRegistry, "getContract" | "getToken">,
  b?: Partial<AddressRegistry>,
): AddressRegistry {
  return {
    getContract(protocol: string, role: string, chainId: ChainId) {
      try { return a.getContract(protocol, role, chainId); } catch (e) {
        if (b?.getContract) return b.getContract(protocol, role, chainId);
        throw e;
      }
    },
    getToken(symbol: string, chainId: ChainId) {
      return a.getToken(symbol, chainId); // token list is the canonical source
    },
  };
}
