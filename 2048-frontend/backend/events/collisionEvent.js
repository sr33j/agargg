import gameState from '../state/gameState.js';

export function setupCollisionEventListener(contract, io) {
  const handleCollision = (winner, loser, winnerNewAmount, loserAmount, event) => {
    console.log(`⚔️ Collision: ${winner} absorbed ${loser}`);
    const winnerAddress = winner.toLowerCase();
    const loserAddress = loser.toLowerCase();

    // Update winner's monAmount
    const winnerState = gameState.getPlayer(winnerAddress);
    if (winnerState) {
      gameState.updatePlayer(winnerAddress, {
        monAmount: winnerNewAmount.toString()
      });
    }

    // Remove loser from game state
    gameState.removePlayer(loserAddress);

    // Broadcast collision event to clients
    io.emit('player-collision', {
      winner: winnerAddress,
      loser: loserAddress,
      winnerNewAmount: winnerNewAmount.toString(),
      loserAmount: loserAmount.toString()
    });
  };

  contract.on('Collision', handleCollision);

  // Return cleanup function
  return () => {
    contract.off('Collision', handleCollision);
  };
}

export default setupCollisionEventListener;