// In-memory game state management
class GameState {
  constructor() {
    this.players = new Map(); // address -> { monAmount, x, y }
    this.pendingMoves = new Map(); // address -> { x, y, blockNumber }
    this.stateLock = { locked: false }; // Simple mutex for state updates
  }

  // Acquire lock for atomic state updates
  async acquireLock() {
    while (this.stateLock.locked) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.stateLock.locked = true;
  }

  releaseLock() {
    this.stateLock.locked = false;
  }

  // Clear all state
  clear() {
    this.players.clear();
    this.pendingMoves.clear();
  }

  // Get player state
  getPlayer(address) {
    return this.players.get(address.toLowerCase());
  }

  // Set player state
  setPlayer(address, state) {
    this.players.set(address.toLowerCase(), state);
  }

  // Update player state
  updatePlayer(address, updates) {
    const current = this.getPlayer(address);
    if (current) {
      this.setPlayer(address, { ...current, ...updates });
    }
  }

  // Remove player
  removePlayer(address) {
    this.players.delete(address.toLowerCase());
  }

  // Get all players
  getAllPlayers() {
    return Array.from(this.players.entries()).map(([address, data]) => ({
      address,
      ...data
    }));
  }

  // Get player count
  getPlayerCount() {
    return this.players.size;
  }

  // Set pending move
  setPendingMove(address, move) {
    this.pendingMoves.set(address.toLowerCase(), move);
  }

  // Get pending move
  getPendingMove(address) {
    return this.pendingMoves.get(address.toLowerCase());
  }

  // Clear pending move
  clearPendingMove(address) {
    this.pendingMoves.delete(address.toLowerCase());
  }

  // Export state for sync
  exportState() {
    return {
      players: this.getAllPlayers(),
      playerCount: this.getPlayerCount()
    };
  }
}

// Singleton instance
export const gameState = new GameState();
export default gameState;