import { getAddress } from "ethers";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

export const EVM_NATIVE_PSEUDO =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const isZero = (addr?: string) =>
  !!addr && addr.toLowerCase() === ZERO_ADDRESS.toLowerCase();

export const isNative = (addr?: string) =>
  !!addr &&
  (addr === EVM_NATIVE_PSEUDO || addr.toLowerCase() === ZERO_ADDRESS.toLowerCase());

export const safeAddress = (a: string) => getAddress(a.toLowerCase());