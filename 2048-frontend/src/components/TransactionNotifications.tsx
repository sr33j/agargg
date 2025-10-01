import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBlockchain } from '../hooks/useBlockchain';
import { WEBSOCKET_URL } from '../config/urls';

interface TransactionNotification {
  id: string;
  txHash: string;
  status: 'sent' | 'confirmed' | 'rejected' | 'expired';
  message: string;
  timestamp: number;
}

const MAX_NOTIFICATIONS = 5;
const AUTO_DISMISS_DELAY = 2000;

export function TransactionNotifications() {
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
  const { pendingTransactions } = useBlockchain();

  // Track pending transaction additions
  useEffect(() => {
    const newSentNotifications = pendingTransactions
      .filter(tx => {
        // Check if we already have a notification for this tx
        return !notifications.some(n => n.txHash === tx.txHash);
      })
      .map(tx => ({
        id: `${tx.txHash}-sent`,
        txHash: tx.txHash,
        status: 'sent' as const,
        message: `Transaction sent: ${tx.action}${tx.direction ? ` (${tx.direction})` : ''}`,
        timestamp: Date.now()
      }));

    if (newSentNotifications.length > 0) {
      setNotifications(prev => {
        const combined = [...newSentNotifications, ...prev];
        return combined.slice(0, MAX_NOTIFICATIONS);
      });
    }
  }, [pendingTransactions]);

  // WebSocket connection for transaction status updates
  useEffect(() => {
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });

    // Listen for transaction confirmations
    socket.on('transaction-confirmed', (data: { txHash: string; action: string }) => {
      const notification: TransactionNotification = {
        id: `${data.txHash}-confirmed`,
        txHash: data.txHash,
        status: 'confirmed',
        message: `Transaction confirmed: ${data.action}`,
        timestamp: Date.now()
      };

      setNotifications(prev => {
        const filtered = prev.filter(n => n.txHash !== data.txHash);
        const combined = [notification, ...filtered];
        return combined.slice(0, MAX_NOTIFICATIONS);
      });
    });

    // Listen for transaction expirations
    socket.on('transaction-expired', (data: { txHash: string; action: string }) => {
      const notification: TransactionNotification = {
        id: `${data.txHash}-expired`,
        txHash: data.txHash,
        status: 'expired',
        message: `Transaction expired: ${data.action}`,
        timestamp: Date.now()
      };

      setNotifications(prev => {
        const filtered = prev.filter(n => n.txHash !== data.txHash);
        const combined = [notification, ...filtered];
        return combined.slice(0, MAX_NOTIFICATIONS);
      });
    });

    // Listen for transaction failures/reverts
    socket.on('transaction-failed', (data: { txHash: string; action: string; reason: string }) => {
      const notification: TransactionNotification = {
        id: `${data.txHash}-rejected`,
        txHash: data.txHash,
        status: 'rejected',
        message: `Transaction failed: ${data.action}`,
        timestamp: Date.now()
      };

      setNotifications(prev => {
        const filtered = prev.filter(n => n.txHash !== data.txHash);
        const combined = [notification, ...filtered];
        return combined.slice(0, MAX_NOTIFICATIONS);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-dismiss notifications after delay
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNotifications(prev =>
        prev.filter(n => now - n.timestamp < AUTO_DISMISS_DELAY)
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: TransactionNotification['status']) => {
    switch (status) {
      case 'sent': return '#3b82f6'; // blue
      case 'confirmed': return '#10b981'; // green
      case 'rejected': return '#ef4444'; // red
      case 'expired': return '#f59e0b'; // orange
    }
  };

  const getStatusIcon = (status: TransactionNotification['status']) => {
    switch (status) {
      case 'sent': return '📤';
      case 'confirmed': return '✅';
      case 'rejected': return '❌';
      case 'expired': return '⏰';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      right: '20px',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 2000,
      maxWidth: '320px'
    }}>
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            padding: '12px 16px',
            background: `linear-gradient(to right, ${getStatusColor(notification.status)}ee, ${getStatusColor(notification.status)}cc)`,
            color: 'white',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            animation: 'slideIn 0.3s ease-out',
            opacity: index >= MAX_NOTIFICATIONS ? 0 : 1 - (Date.now() - notification.timestamp) / AUTO_DISMISS_DELAY,
            transition: 'opacity 0.3s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '16px' }}>{getStatusIcon(notification.status)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '500' }}>{notification.message}</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
              {notification.txHash.slice(0, 10)}...{notification.txHash.slice(-8)}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default TransactionNotifications;