export type ChainId = number;

export interface SchemaStore {
  getActionSchema(protocol: string, action: string, version?: string): Promise<any>;
}

export interface AddressRegistry {
  /** e.g. ("uniswap_v3", "router", 1) -> 0x... */
  getContract(protocol: string, role: string, chainId: ChainId): `0x${string}`;
  /** e.g. ("USDC", 1) -> { address, decimals } */
  getToken(symbol: string, chainId: ChainId): { address: `0x${string}`; decimals: number };
}
