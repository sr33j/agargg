import gameState from '../state/gameState.js';

export function setupRedepositEventListener(contract, io) {
  const handleRedeposit = (player, addedAmount, newMonAmount, event) => {
    console.log(`💰 Player redeposited: ${player}, added: ${addedAmount}, new total: ${newMonAmount}`);
    const playerAddress = player.toLowerCase();

    // Update player's monAmount in game state
    const playerState = gameState.getPlayer(playerAddress);
    if (playerState) {
      gameState.updatePlayer(playerAddress, {
        monAmount: newMonAmount.toString()
      });

      // Broadcast to all clients
      io.emit('player-redeposited', {
        address: playerAddress,
        addedAmount: addedAmount.toString(),
        newMonAmount: newMonAmount.toString()
      });
    }
  };

  contract.on('Redeposit', handleRedeposit);

  // Return cleanup function
  return () => {
    contract.off('Redeposit', handleRedeposit);
  };
}

export default setupRedepositEventListener;