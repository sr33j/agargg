import { PlayerState } from '../types';
import { MAX_POSITION_ATTEMPTS } from '../constants';

// Babylonian method for square root (matching contract)
function sqrt(x: bigint): bigint {
  if (x === 0n) return 0n;
  let z = (x + 1n) / 2n;
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / 2n;
  }
  return y;
}

// Helper: radius calculation (EXACTLY matching contract)
export function getRadius(monAmount: bigint): number {
  // pi ~ 3.14159 * 1e18 for precision (same as contract)
  const pi = 3141592653589793238n;
  // area = monAmount, area = pi * r^2 => r = sqrt(monAmount * 1e18 / pi)
  // Contract formula: sqrt(monAmount * 1e18 / pi)
  const scaledAmount = monAmount * BigInt(1e18);
  const radiusBigInt = sqrt(scaledAmount / pi);
  return Number(radiusBigInt);
}

// Helper: velocity calculation (EXACTLY matching contract)
export function getVelocity(
  monAmount: bigint,
  minMonAmount: bigint,
  maxMonAmount: bigint,
  velocityMin: number,
  velocityMax: number
): number {
  // Match contract logic exactly
  if (monAmount <= minMonAmount) return velocityMax;
  if (maxMonAmount === 0n || monAmount >= maxMonAmount) return velocityMin;
  if (maxMonAmount <= minMonAmount) return velocityMin;
  
  // Linear interpolation matching contract
  const range = maxMonAmount - minMonAmount;
  const position = monAmount - minMonAmount;
  const velocityRange = BigInt(velocityMax - velocityMin);
  
  const reduction = (position * velocityRange) / range;
  return velocityMax - Number(reduction);
}

// Helper: check collision between two players (matching contract)
export function playersConflict(
  x1: number, 
  y1: number, 
  m1: bigint, 
  x2: number, 
  y2: number, 
  m2: bigint
): boolean {
  const r1 = getRadius(m1);
  const r2 = getRadius(m2);
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  const distSq = dx * dx + dy * dy;
  const radSum = r1 + r2;
  return distSq < radSum * radSum;
}

// Find a random valid (x, y) position
export function findValidPosition(
  radius: number,
  contractBoardWidth: number,
  contractBoardHeight: number,
  allPlayers: PlayerState[],
  monAmount: bigint
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt++) {
    const x = Math.floor(Math.random() * (contractBoardWidth - 2 * radius)) + Math.floor(radius);
    const y = Math.floor(Math.random() * (contractBoardHeight - 2 * radius)) + Math.floor(radius);
    
    let collision = false;
    for (const p of allPlayers) {
      if (p.monAmount === 0n) continue;
      if (playersConflict(x, y, monAmount, Number(p.x), Number(p.y), p.monAmount)) {
        collision = true;
        break;
      }
    }
    if (!collision) return { x, y };
  }
  return null;
} 