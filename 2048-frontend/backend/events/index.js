import setupEnterEventListener from './enterEvent.js';
import setupMoveEventListener from './moveEvent.js';
import setupLeaveEventListener from './leaveEvent.js';
import setupRedepositEventListener from './redepositEvent.js';
import setupCollisionEventListener from './collisionEvent.js';
import setupBlockEventListener from './blockEvent.js';

export function setupEventListeners(contract, wsProvider, io, moveFee, blockchainConnection) {
  console.log('📡 Setting up event listeners...');

  const cleanupFunctions = [];

  // Contract event listeners
  cleanupFunctions.push(setupEnterEventListener(contract, io));
  cleanupFunctions.push(setupMoveEventListener(contract, io, moveFee));
  cleanupFunctions.push(setupLeaveEventListener(contract, io));
  cleanupFunctions.push(setupRedepositEventListener(contract, io));
  cleanupFunctions.push(setupCollisionEventListener(contract, io));

  // Block event listener - pass blockchainConnection reference for timeout monitoring
  cleanupFunctions.push(setupBlockEventListener(wsProvider, io, blockchainConnection));

  console.log('✅ Event listeners configured');

  // Return a cleanup function that removes all listeners
  return () => {
    console.log('🧹 Cleaning up event listeners...');
    cleanupFunctions.forEach(cleanup => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
  };
}

export default setupEventListeners;