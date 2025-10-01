import gameState from '../state/gameState.js';

export function setupEnterEventListener(contract, io) {
  const handleEnter = (player, monAmount, x, y, event) => {
    console.log(`🎮 Player entered: ${player}`);
    const playerAddress = player.toLowerCase();

    // Update game state
    gameState.setPlayer(playerAddress, {
      monAmount: monAmount.toString(),
      x: Number(x),
      y: Number(y)
    });

    // Broadcast to all clients
    io.emit('player-entered', {
      address: playerAddress,
      monAmount: monAmount.toString(),
      x: Number(x),
      y: Number(y)
    });
  };

  contract.on('Enter', handleEnter);

  // Return cleanup function
  return () => {
    contract.off('Enter', handleEnter);
  };
}

export default setupEnterEventListener;