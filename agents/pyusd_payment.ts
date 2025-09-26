import { executeIntent } from '../sdk/src';
import { MainnetRegistry } from './registry';

async function main() {
    // Example: Send 1 PYUSD (testnet) to a recipient
    const intent = {
        actions: [
            {
                protocol: 'erc20',
                action: 'transfer',
                params: {
                    token: MainnetRegistry.getToken('PYUSD', 1).address,
                    to: '0x08Cb58C5F9Eff674ac10aFfF7393f14fCbb53A10', // replace with recipient address
                    amount: '10000', // 1 PYUSD (6 decimals)
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

    console.log('PYUSD transfer result:', res);
}

main().catch(console.error);
