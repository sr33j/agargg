import gameState from '../state/gameState.js';

export function setupMoveEventListener(contract, io, moveFee) {
  const handleMove = async (player, x, y, event) => {
    const playerAddress = player.toLowerCase();
    console.log(`🏃 Player moved: ${player} to (${x}, ${y})`);

    // Acquire lock for atomic state updates
    await gameState.acquireLock();

    try {
      // Check if player died (position 0,0)
      if (x === 0n && y === 0n) {
        console.log(`💀 Player died: ${player}`);
        gameState.removePlayer(playerAddress);
        io.emit('player-died', { address: playerAddress });
      } else {
        // Get current state and update position
        const currentState = gameState.getPlayer(playerAddress);
        if (currentState) {
          const newMonAmount = BigInt(currentState.monAmount) - moveFee;
          const newX = Number(x);
          const newY = Number(y);

          // Update player state
          gameState.setPlayer(playerAddress, {
            monAmount: newMonAmount.toString(),
            x: newX,
            y: newY
          });

          io.emit('player-moved', {
            address: playerAddress,
            x: newX,
            y: newY,
            monAmount: newMonAmount.toString()
          });
        }
      }
    } finally {
      gameState.releaseLock();
    }
  };

  contract.on('Move', handleMove);

  // Return cleanup function
  return () => {
    contract.off('Move', handleMove);
  };
}

export default setupMoveEventListener;