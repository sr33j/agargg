import React, { useEffect, useState } from 'react';
import { useBlockchain } from '../hooks/useBlockchain';

export function BlockNumberDisplay() {
  const { currentBlockNumber, lastBlockUpdate, isConnected } = useBlockchain();
  const [isStale, setIsStale] = useState(false);

  // Check for staleness
  useEffect(() => {
    const checkStaleness = () => {
      if (lastBlockUpdate) {
        const secondsSinceUpdate = (Date.now() - lastBlockUpdate.getTime()) / 1000;
        setIsStale(secondsSinceUpdate > 5); // Mark as stale after 5 seconds (blocks come ~1s)
      } else {
        setIsStale(!isConnected);
      }
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 1000);

    return () => clearInterval(interval);
  }, [lastBlockUpdate, isConnected]);

  const getTimeSinceUpdate = () => {
    if (!lastBlockUpdate) return 'Never';
    const seconds = Math.floor((Date.now() - lastBlockUpdate.getTime()) / 1000);
    if (seconds < 1) return 'Just now';
    if (seconds === 1) return '1 second ago';
    return `${seconds} seconds ago`;
  };

  const getConnectionStatus = () => {
    if (!isConnected) return ' (Disconnected)';
    if (isStale) return ' (STALE!)';
    return '';
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      padding: '12px 16px',
      background: isStale ? 'rgba(255, 50, 50, 0.9)' : 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      minWidth: '200px'
    }}>
      <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
        Monad Block Number
      </div>
      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
        {currentBlockNumber ? (
          <>
            #{currentBlockNumber.toString()}
            <span style={{
              color: isStale || !isConnected ? '#ff6b6b' : '#4caf50',
              marginLeft: '8px',
              fontSize: '11px'
            }}>
              {getConnectionStatus()}
            </span>
          </>
        ) : (
          'Loading...'
        )}
      </div>
      <div style={{ fontSize: '10px', color: '#999' }}>
        Updated: {getTimeSinceUpdate()}
      </div>
    </div>
  );
}