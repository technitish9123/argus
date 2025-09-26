import { executeIntent } from '../src/intent/execute';
import { MainnetRegistry } from './registry';

async function main() {
  const intent = {
    actions: [
      {
        protocol: 'uniswap_v3',
        action: 'exactInputSingle',
        params: {
          tokenIn: MainnetRegistry.getToken('WETH', 1).address,
          tokenOut: MainnetRegistry.getToken('USDC', 1).address,
          fee: 3000,
          recipient: '0xYourAddressHere', // replace with your address
          deadline: Math.floor(Date.now() / 1000) + 1200,
          amountIn: '100000000000000000', // 0.1 WETH in wei
          amountOutMinimum: '1', // minimum USDC out
          sqrtPriceLimitX96: '0'
        }
      }
    ],
    meta: { chainId: 1 }
  };

  const res = await executeIntent(intent, {
    rpcUrl: process.env.RPC_URL!,
    privateKey: process.env.PRIVATE_KEY!,
    chainIdDefault: 1,
    registry: MainnetRegistry,
    debug: true
  });

  console.log('Swap result:', res);
}

main().catch(console.error);
