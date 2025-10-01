import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import type { Address } from 'viem';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AgarGameAbi = require('../contracts/abi/AgarGame.json');

// Minimal Direction constants matching the contract (avoid TS enum for ts-node strip-only)
const Direction = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
} as const;
type Direction = typeof Direction[keyof typeof Direction];

type Player = { monAmount: bigint; x: bigint; y: bigint };

async function main() {
  const EMBEDDED_WALLET = (process.env.WALLET as Address) || '0xcDAaa210041f9Cd78ebF8EAfA86A7B7C0Aa1D9C2';
  const GAME_ADDR = (process.env.GAME as Address) || '0x4b46ca98ecf45e1819a661F9616E2baF7d983b30';
  const RPC = process.env.RPC || 'https://testnet-rpc.monad.xyz';

  const client = createPublicClient({ transport: http(RPC) });

  const [nativeBalance, moveFee, minMonAmount, playerTuple] = await Promise.all([
    client.getBalance({ address: EMBEDDED_WALLET }),
    client.readContract({ address: GAME_ADDR, abi: AgarGameAbi as any, functionName: 'moveFee', args: [] }) as Promise<bigint>,
    client.readContract({ address: GAME_ADDR, abi: AgarGameAbi as any, functionName: 'minMonAmount', args: [] }) as Promise<bigint>,
    client.readContract({
      address: GAME_ADDR,
      abi: AgarGameAbi as any,
      functionName: 'players',
      args: [EMBEDDED_WALLET],
    }) as Promise<[bigint, bigint, bigint]>,
  ]);

  const player: Player = { monAmount: playerTuple[0], x: playerTuple[1], y: playerTuple[2] };

  const directions: { name: string; value: Direction }[] = [
    { name: 'UP', value: Direction.UP },
    { name: 'DOWN', value: Direction.DOWN },
    { name: 'LEFT', value: Direction.LEFT },
    { name: 'RIGHT', value: Direction.RIGHT },
  ];

  async function tryEstimate(dir: Direction) {
    try {
      const gas = await client.estimateContractGas({
        address: GAME_ADDR,
        abi: AgarGameAbi as any,
        functionName: 'move',
        args: [dir],
        account: EMBEDDED_WALLET,
      });
      return { ok: true, gas: gas.toString() };
    } catch (e: any) {
      let reason = e?.shortMessage || e?.message || 'Unknown error';
      return { ok: false, reason };
    }
  }

  const estimates = await Promise.all(directions.map(async d => ({ name: d.name, result: await tryEstimate(d.value) })));

  const summary = {
    wallet: EMBEDDED_WALLET,
    game: GAME_ADDR,
    rpc: RPC,
    nativeBalance: nativeBalance.toString(),
    playerMonAmount: player.monAmount.toString(),
    moveFee: moveFee.toString(),
    minMonAmount: minMonAmount.toString(),
    canMove: player.monAmount >= moveFee,
    estimates,
  };

  // Pretty print
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


