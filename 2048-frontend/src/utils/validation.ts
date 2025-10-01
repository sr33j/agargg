import { PlayerState } from '../types';
import { getRadius } from './game';

// Validate player state consistency
export function validatePlayerState(player: PlayerState | undefined): boolean {
  if (!player) return false;
  
  // Check if player has valid monAmount
  if (!player.monAmount || player.monAmount <= 0n) {
    return false;
  }
  
  // Check if position is valid (not at origin unless dead)
  if (player.x === 0n && player.y === 0n && player.monAmount > 0n) {
    console.warn(`Invalid player state: ${player.address} at origin with monAmount > 0`);
    return false;
  }
  
  // Check if address is valid
  if (!player.address || !player.address.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.warn(`Invalid player address: ${player.address}`);
    return false;
  }
  
  return true;
}

// Check if player can perform actions
export function canPlayerMove(
  player: PlayerState | undefined,
  moveFee: bigint
): { valid: boolean; reason?: string } {
  if (!validatePlayerState(player)) {
    return { valid: false, reason: 'Invalid player state' };
  }
  
  if (!player || player.monAmount <= 0n) {
    return { valid: false, reason: 'Player not in game or absorbed' };
  }
  
  if (player.monAmount < moveFee) {
    return { valid: false, reason: 'Insufficient MON for move fee' };
  }
  
  return { valid: true };
}

// Validate collision between players
export function validateCollision(
  player1: PlayerState,
  player2: PlayerState
): { shouldCollide: boolean; winner?: string; loser?: string } {
  // Both players must be valid
  if (!validatePlayerState(player1) || !validatePlayerState(player2)) {
    return { shouldCollide: false };
  }
  
  // Players must be different
  if (player1.address.toLowerCase() === player2.address.toLowerCase()) {
    return { shouldCollide: false };
  }
  
  // Calculate collision based on positions and radii
  const dx = Math.abs(Number(player1.x) - Number(player2.x));
  const dy = Math.abs(Number(player1.y) - Number(player2.y));
  const distSq = dx * dx + dy * dy;
  
  // Calculate radii using the corrected getRadius function (matching contract)
  const r1 = getRadius(player1.monAmount);
  const r2 = getRadius(player2.monAmount);
  const radSum = r1 + r2;
  
  if (distSq >= radSum * radSum) {
    return { shouldCollide: false };
  }
  
  // Determine winner
  if (player1.monAmount > player2.monAmount) {
    return { 
      shouldCollide: true, 
      winner: player1.address, 
      loser: player2.address 
    };
  } else if (player2.monAmount > player1.monAmount) {
    return { 
      shouldCollide: true, 
      winner: player2.address, 
      loser: player1.address 
    };
  } else {
    // Equal size - no collision in game rules
    return { shouldCollide: false };
  }
}

// Validate game state consistency
export function validateGameState(
  allPlayers: PlayerState[],
  boardWidth: number,
  boardHeight: number
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const seenAddresses = new Set<string>();
  
  for (const player of allPlayers) {
    const addr = player.address.toLowerCase();
    
    // Check for duplicates
    if (seenAddresses.has(addr)) {
      issues.push(`Duplicate player: ${addr}`);
    }
    seenAddresses.add(addr);
    
    // Validate individual player
    if (!validatePlayerState(player)) {
      issues.push(`Invalid player state: ${addr}`);
      continue;
    }
    
    // Check board boundaries
    if (Number(player.x) < 0 || Number(player.x) > boardWidth) {
      issues.push(`Player ${addr} X position out of bounds: ${player.x}`);
    }
    if (Number(player.y) < 0 || Number(player.y) > boardHeight) {
      issues.push(`Player ${addr} Y position out of bounds: ${player.y}`);
    }
  }
  
  return { 
    valid: issues.length === 0, 
    issues 
  };
}

// Sanitize player list to remove invalid entries
export function sanitizePlayerList(players: PlayerState[]): PlayerState[] {
  const validPlayers: PlayerState[] = [];
  const seenAddresses = new Set<string>();
  
  for (const player of players) {
    const addr = player.address.toLowerCase();
    
    // Skip duplicates
    if (seenAddresses.has(addr)) {
      continue;
    }
    
    // Skip invalid players
    if (!validatePlayerState(player)) {
      continue;
    }
    
    // Skip players with 0 monAmount
    if (player.monAmount <= 0n) {
      continue;
    }
    
    seenAddresses.add(addr);
    validPlayers.push(player);
  }
  
  return validPlayers;
}

// Check if a move is valid
export function validateMove(
  player: PlayerState,
  newX: number,
  newY: number,
  boardWidth: number,
  boardHeight: number
): { valid: boolean; reason?: string } {
  if (!validatePlayerState(player)) {
    return { valid: false, reason: 'Invalid player state' };
  }
  
  // Check board boundaries with radius (using corrected getRadius)
  const radius = getRadius(player.monAmount);
  
  if (newX < radius) {
    return { valid: false, reason: 'Move would collide with wall (left boundary)' };
  }
  
  if (newX + radius > boardWidth) {
    return { valid: false, reason: 'Move would collide with wall (right boundary)' };
  }
  
  if (newY < radius) {
    return { valid: false, reason: 'Move would collide with wall (top boundary)' };
  }
  
  if (newY + radius > boardHeight) {
    return { valid: false, reason: 'Move would collide with wall (bottom boundary)' };
  }
  
  return { valid: true };
}