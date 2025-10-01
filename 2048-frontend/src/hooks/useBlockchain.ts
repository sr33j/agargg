import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { publicClient } from '../utils/client';
import { PendingTransaction, UseBlockchainReturn, Direction } from '../types';
import { TRANSACTION_DEADLINE_BLOCKS } from '../constants';
import { WEBSOCKET_URL } from '../config/urls';

export function useBlockchain(): UseBlockchainReturn {
  const [currentBlockNumber, setCurrentBlockNumber] = useState<bigint>(0n);
  const [lastBlockUpdate, setLastBlockUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);

  const socketRef = useRef<Socket | null>(null);
  
  // Connect to WebSocket for block updates
  useEffect(() => {
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('🔗 Connected to blockchain WebSocket');
      setIsConnected(true);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from blockchain WebSocket');
      setIsConnected(false);
    });
    
    socket.on('connection-status', (data: { connected: boolean }) => {
      setIsConnected(data.connected);
    });
    
    // Listen for block updates
    socket.on('block-update', (data: { blockNumber: string }) => {
      const blockNumber = BigInt(data.blockNumber);
      // console.log(`📦 Block update: ${blockNumber}`);
      setCurrentBlockNumber(blockNumber);
      setLastBlockUpdate(new Date());
    });
    
    // Listen for transaction confirmations
    socket.on('transaction-confirmed', (data: { txHash: string; action: string; blockNumber: string }) => {
      console.log(`✅ Transaction confirmed: ${data.txHash}`);
      setPendingTransactions(prev => prev.filter(tx => tx.txHash !== data.txHash));
    });
    
    // Listen for transaction expirations
    socket.on('transaction-expired', (data: { txHash: string; action: string; deadline: string }) => {
      console.log(`❌ Transaction expired: ${data.txHash}`);
      setPendingTransactions(prev => prev.filter(tx => tx.txHash !== data.txHash));
    });

    // Listen for transaction failures/reverts
    socket.on('transaction-failed', (data: { txHash: string; action: string; reason: string }) => {
      console.log(`❌ Transaction failed: ${data.txHash}, reason: ${data.reason}`);
      setPendingTransactions(prev => prev.filter(tx => tx.txHash !== data.txHash));
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  // Fallback block number fetching if WebSocket is not available
  useEffect(() => {
    if (isConnected) return; // Don't poll if WebSocket is working
    
    const fetchBlockNumber = async () => {
      try {
        const blockNumber = await publicClient.getBlockNumber();
        setCurrentBlockNumber(blockNumber);
        setLastBlockUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch block number:', error);
      }
    };
    
    fetchBlockNumber();
    const interval = setInterval(fetchBlockNumber, 2000); // Poll every 2 seconds as fallback
    return () => clearInterval(interval);
  }, [isConnected]);

  // Filter expired transactions and check for failed transactions
  useEffect(() => {
    if (currentBlockNumber === 0n) return; // Don't filter if we don't have current block yet
    
    setPendingTransactions(prev => {
      const expired = prev.filter(tx => currentBlockNumber >= tx.deadline);
      const active = prev.filter(tx => currentBlockNumber < tx.deadline);
      
      if (expired.length > 0) {
        console.log(`🕰️ Filtering ${expired.length} expired transactions:`, expired.map(tx => tx.txHash));
      }
      
      return active;
    });
  }, [currentBlockNumber]);

  // Periodically check for failed transactions (client-side fallback)
  useEffect(() => {
    const checkTransactionReceipts = async () => {
      if (pendingTransactions.length === 0) return;
      
      // Only check transactions older than 30 seconds
      const oldTransactions = pendingTransactions.filter(
        tx => Date.now() - tx.timestamp > 30000
      );
      
      for (const tx of oldTransactions) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: tx.txHash as `0x${string}` });
          
          // If transaction was included but failed (status = 0)
          if (receipt && receipt.status === 'reverted') {
            console.log(`❌ Detected failed transaction: ${tx.txHash}`);
            setPendingTransactions(prev => prev.filter(ptx => ptx.txHash !== tx.txHash));
          }
          // If transaction was successful, it should have been removed by server already
          else if (receipt && receipt.status === 'success') {
            console.log(`✅ Detected confirmed transaction not removed by server: ${tx.txHash}`);
            setPendingTransactions(prev => prev.filter(ptx => ptx.txHash !== tx.txHash));
          }
        } catch (error) {
          // Transaction not found yet, keep waiting
          continue;
        }
      }
    };
    
    const interval = setInterval(checkTransactionReceipts, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [pendingTransactions]);
  
  const trackTransaction = useCallback((txHash: string, deadline: bigint, action: string, direction?: Direction, nonce?: bigint) => {
    console.log(`📝 Tracking transaction: ${txHash}, deadline: ${deadline}, action: ${action}, direction: ${direction}, nonce: ${nonce}`);

    const newTransaction: PendingTransaction = {
      txHash,
      deadline,
      action,
      timestamp: Date.now(),
      direction,
      nonce
    };

    setPendingTransactions(prev => [...prev, newTransaction]);

    // Tell server to track this transaction
    if (socketRef.current?.connected) {
      socketRef.current.emit('track-transaction', {
        txHash,
        deadline: deadline.toString(),
        action,
        direction,
        nonce: nonce?.toString(),
        player: 'current' // Will be replaced with actual player address in server
      });
    }
  }, []);
  
  const getCurrentDeadline = useCallback(() => {
    return currentBlockNumber + BigInt(TRANSACTION_DEADLINE_BLOCKS); // T+10 scheme
  }, [currentBlockNumber]);
  
  return {
    currentBlockNumber,
    lastBlockUpdate,
    isConnected,
    pendingTransactions,
    trackTransaction,
    getCurrentDeadline,
  };
}
