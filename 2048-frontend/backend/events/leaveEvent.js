import gameState from '../state/gameState.js';

export function setupLeaveEventListener(contract, io) {
  const handleLeave = (player, monAmount, event) => {
    console.log(`👋 Player left: ${player}`);
    const playerAddress = player.toLowerCase();

    // Remove player from game state
    gameState.removePlayer(playerAddress);

    // Broadcast to all clients
    io.emit('player-left', {
      address: playerAddress,
      monAmount: monAmount.toString()
    });
  };

  contract.on('Leave', handleLeave);

  // Return cleanup function
  return () => {
    contract.off('Leave', handleLeave);
  };
}

export default setupLeaveEventListener;