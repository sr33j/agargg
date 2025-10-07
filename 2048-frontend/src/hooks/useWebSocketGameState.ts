import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { publicClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import { AGAR_GAME_ADDRESS, GAME_STATE_REFRESH_INTERVAL, WEBSOCKET_RECONNECT_DELAY, WEBSOCKET_HEARTBEAT_INTERVAL } from '../constants';
import { PlayerState, UseGameStateReturn } from '../types';
import { WEBSOCKET_URL } from '../config/urls';

export function useWebSocketGameState(userAddress: string): UseGameStateReturn {
  const [minMonAmount, setMinMonAmount] = useState<bigint>(1n);
  const [maxMonAmount, setMaxMonAmount] = useState<bigint>(1000n);
  const [allPlayers, setAllPlayers] = useState<PlayerState[]>([]);
  const [joined, setJoined] = useState(false);
  const [contractBoardWidth, setContractBoardWidth] = useState<number>(1000);
  const [contractBoardHeight, setContractBoardHeight] = useState<number>(1000);
  
  // Track WebSocket connection; internal debug only (no state needed)
  
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isConnectedRef = useRef<boolean>(false);  // Guard against StrictMode double connections

  // Fetch contract parameters (same as original)
  useEffect(() => {
    async function fetchParams() {
      const min = await publicClient.readContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'minMonAmount',
      });
      setMinMonAmount(min as bigint);
      const max = await publicClient.readContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'getMaxSize',
      });
      setMaxMonAmount(max as bigint);
    }
    fetchParams();
  }, []);

  // Fetch board dimensions (same as original)
  useEffect(() => {
    async function fetchBoardSize() {
      const w = await publicClient.readContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'boardWidth',
      });
      const h = await publicClient.readContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'boardHeight',
      });
      setContractBoardWidth(Number(w));
      setContractBoardHeight(Number(h));
    }
    fetchBoardSize();
  }, []);

  // Polling fallback (same as original useGameState)
  const fetchAllPlayers = useCallback(async () => {
    const addresses = await publicClient.readContract({
      address: AGAR_GAME_ADDRESS,
      abi: AgarGameAbi,
      functionName: 'getAllPlayers',
    });
    if (!Array.isArray(addresses) || !addresses.every(a => typeof a === 'string')) {
      setAllPlayers([]);
      return;
    }
    const stringAddresses = addresses as string[];
    const playerStates = await Promise.all(
      stringAddresses.map(async (addr: string) => {
        const [monAmount, x, y] = await publicClient.readContract({
          address: AGAR_GAME_ADDRESS,
          abi: AgarGameAbi,
          functionName: 'players',
          args: [addr],
        }) as [bigint, bigint, bigint];
        return { address: addr, monAmount, x, y };
      })
    );
    
    // CRITICAL FIX: Filter out players with monAmount = 0 (they've been absorbed)
    const activePlayers = playerStates.filter(p => p.monAmount > 0n);
    
    // Deduplicate players by address (case-insensitive)
    const uniquePlayers = Array.from(
      new Map(activePlayers.map(p => [p.address.toLowerCase(), p])).values()
    );
    
    setAllPlayers(uniquePlayers);
  }, []);

  // Full sync from contract - single source of truth
  const fullSyncFromContract = useCallback(async () => {
    console.log('🔄 Starting full sync from contract...');

    try {
      // Fetch all players from contract
      const addresses = await publicClient.readContract({
        address: AGAR_GAME_ADDRESS,
        abi: AgarGameAbi,
        functionName: 'getAllPlayers',
      });

      if (!Array.isArray(addresses)) {
        console.log('⚠️ No players found');
        setAllPlayers([]);
        return;
      }

      // Fetch each player's state
      const playerStates = await Promise.all(
        (addresses as string[]).map(async (addr: string) => {
          const [monAmount, x, y] = await publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'players',
            args: [addr],
          }) as [bigint, bigint, bigint];
          return { address: addr, monAmount, x, y };
        })
      );

      // Filter active players (monAmount > 0)
      const activePlayers = playerStates.filter(p => p.monAmount > 0n);

      // Deduplicate by address
      const uniquePlayers = Array.from(
        new Map(activePlayers.map(p => [p.address.toLowerCase(), p])).values()
      );

      // Update all players state
      setAllPlayers(uniquePlayers);
      console.log(`✅ Full sync complete: ${uniquePlayers.length} active players`);
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      // On error, clear state to safe defaults
      setAllPlayers([]);
    }
  }, []);

  // Start polling fallback
  const startPolling = useCallback(() => {
    console.log('📊 Starting polling fallback');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    fetchAllPlayers();
    pollingIntervalRef.current = window.setInterval(fetchAllPlayers, GAME_STATE_REFRESH_INTERVAL);
  }, [fetchAllPlayers]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('🛑 Stopping polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    // Guard against duplicate connections (React StrictMode)
    if (isConnectedRef.current || socketRef.current?.connected) {
      console.log('⚠️ WebSocket already connected, skipping...');
      return;
    }

    console.log('🔌 Connecting to WebSocket server...');

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(WEBSOCKET_URL, {
      reconnection: false, // We'll handle reconnection manually for better control
      transports: ['websocket'],
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      isConnectedRef.current = true;  // Mark as connected
      stopPolling(); // Stop polling when connected

      // Request server-side sync - backend will send full-sync event with authoritative state
      socket.emit('request-sync');

      // Start heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = window.setInterval(() => {
        socket.emit('ping');
      }, WEBSOCKET_HEARTBEAT_INTERVAL);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected, reason:', reason);
      isConnectedRef.current = false;  // Mark as disconnected
      startPolling(); // Fall back to polling

      // Stop heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Schedule reconnection
      if (!reconnectTimeoutRef.current) {
        console.log(`🔄 Scheduling reconnection in ${WEBSOCKET_RECONNECT_DELAY}ms...`);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          isConnectedRef.current = false;  // Ensure flag is cleared before reconnect
          connectWebSocket();
        }, WEBSOCKET_RECONNECT_DELAY);
      }
    });

    // Handle WebSocket errors
    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    socket.on('connection-status', (data: { connected: boolean }) => {
      console.log('📡 Connection status:', data.connected);
      if (!data.connected) {
        // Server lost blockchain connection, fall back to polling
        startPolling();
      }
    });

    socket.on('full-sync', (players: Array<{ address: string; monAmount: string; x: number; y: number }>) => {
      console.log(`🔄 Received full sync with ${players.length} players`);
      // Wipe current state before rebuilding from authoritative snapshot
      setAllPlayers([]);
      const playerStates: PlayerState[] = players.map(p => ({
        address: p.address,
        monAmount: BigInt(p.monAmount),
        x: BigInt(p.x),
        y: BigInt(p.y),
      }));
      const active = playerStates.filter(p => p.monAmount > 0n);
      const unique = Array.from(new Map(active.map(p => [p.address.toLowerCase(), p])).values());
      setAllPlayers(unique);
      console.log(`🔄 Full sync received: ${unique.length} active players`);
    });

    socket.on('player-entered', (data: { address: string; monAmount: string; x: number; y: number }) => {
      const playerAddr = data.address.toLowerCase();
      const isCurrentUser = playerAddr === userAddress.toLowerCase();
      console.log(`🎮 ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} entered:`, {
        address: data.address,
        monAmount: data.monAmount,
        x: data.x,
        y: data.y
      });
      
      setAllPlayers(prev => {
        const filtered = prev.filter(p => p.address.toLowerCase() !== playerAddr);
        const newState = [...filtered, {
          address: data.address,
          monAmount: BigInt(data.monAmount),
          x: BigInt(data.x),
          y: BigInt(data.y),
        }];
        console.log(`🔄 Updated confirmed state after ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} enter: ${newState.length} players`);
        return newState;
      });
    });

    // NEW: Handle redeposit events
    socket.on('player-redeposited', (data: { address: string; addedAmount: string; newMonAmount: string }) => {
      console.log('💰 Player redeposited:', {
        address: data.address,
        addedAmount: data.addedAmount,
        newMonAmount: data.newMonAmount
      });
      const playerAddr = data.address.toLowerCase();
      
      setAllPlayers(prev => {
        const updated = prev.map(p => {
          if (p.address.toLowerCase() === playerAddr) {
            console.log(`🔄 Updating confirmed monAmount for ${playerAddr}: ${p.monAmount} → ${data.newMonAmount}`);
            return {
              ...p,
              monAmount: BigInt(data.newMonAmount),
            };
          }
          return p;
        });
        return updated;
      });
    });

    socket.on('player-moved', (data: { address: string; x: number; y: number; monAmount: string }) => {
      console.log(`🏃 Player moved event:`, {
        address: data.address,
        x: data.x,
        y: data.y,
        monAmount: data.monAmount
      });
      
      const playerAddr = data.address.toLowerCase();

      setAllPlayers(prev => {
        const playerExists = prev.some(p => p.address.toLowerCase() === playerAddr);

        if (!playerExists && BigInt(data.monAmount) > 0n) {
          // Player wasn't in our list but now has monAmount - they entered
          console.log(`🎮 Player ${playerAddr} detected via move event`);
          return [...prev, {
            address: data.address,
            monAmount: BigInt(data.monAmount),
            x: BigInt(data.x),
            y: BigInt(data.y),
          }];
        }

        const updated = prev.map(p => {
          if (p.address.toLowerCase() === playerAddr) {
            const isCurrentUser = playerAddr === userAddress.toLowerCase();
            console.log(`🔄 Updating confirmed ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} position for ${playerAddr}: (${p.x}, ${p.y}) → (${data.x}, ${data.y})`);
            return {
              ...p,
              x: BigInt(data.x),
              y: BigInt(data.y),
              monAmount: BigInt(data.monAmount),
            };
          }
          return p;
        });
        
        return updated;
      });
    });

    socket.on('player-died', (data: { address: string }) => {
      const playerAddr = data.address.toLowerCase();
      const isCurrentUser = playerAddr === userAddress.toLowerCase();
      console.log(`💀 ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} died:`, data.address);

      setAllPlayers(prev => {
        const updated = prev.filter(p => p.address.toLowerCase() !== playerAddr);
        console.log(`📊 Players after ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} death: ${updated.length} (removed ${playerAddr})`);
        return updated;
      });
    });

    socket.on('player-collision', (data: { winner: string; loser: string; winnerNewAmount: string; loserAmount: string }) => {
      const winnerAddr = data.winner.toLowerCase();
      const loserAddr = data.loser.toLowerCase();
      const winnerIsUser = winnerAddr === userAddress.toLowerCase();
      const loserIsUser = loserAddr === userAddress.toLowerCase();
      
      console.log(`⚔️ Collision: ${winnerIsUser ? 'USER' : 'OTHER'} ${data.winner.slice(0,6)} absorbed ${loserIsUser ? 'USER' : 'OTHER'} ${data.loser.slice(0,6)}`);

      setAllPlayers(prev => {
        // Update winner's monAmount and remove loser
        const updated = prev
          .map(p => {
            if (p.address.toLowerCase() === winnerAddr) {
              console.log(`🔄 Updating ${winnerIsUser ? 'USER' : 'OTHER PLAYER'} winner size: ${p.monAmount} → ${data.winnerNewAmount}`);
              return {
                ...p,
                monAmount: BigInt(data.winnerNewAmount),
              };
            }
            return p;
          })
          .filter(p => p.address.toLowerCase() !== loserAddr);
        
        console.log(`📊 Players after collision: ${updated.length} (${loserIsUser ? 'USER' : 'OTHER'} ${loserAddr.slice(0,6)} removed)`);
        return updated;
      });
    });

    socket.on('player-left', (data: { address: string }) => {
      const playerAddr = data.address.toLowerCase();
      const isCurrentUser = playerAddr === userAddress.toLowerCase();
      console.log(`👋 ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} left:`, data.address);

      setAllPlayers(prev => {
        const updated = prev.filter(p => p.address.toLowerCase() !== playerAddr);
        console.log(`📊 Players after ${isCurrentUser ? 'USER' : 'OTHER PLAYER'} leave: ${updated.length} (removed ${playerAddr})`);
        return updated;
      });
    });

    socket.on('pong', () => {
      // Heartbeat response received
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error.message);
      startPolling(); // Fall back to polling
    });

  }, [stopPolling, startPolling]);

  // Initialize: load initial state and connect WebSocket (run once on mount)
  useEffect(() => {
    // Do full sync from contract first (single source of truth)
    fullSyncFromContract();

    // Then connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');

      isConnectedRef.current = false;  // Clear connection flag

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount - intentionally empty dependencies

  // Check if current user has joined based on allPlayers state
  useEffect(() => {
    if (!userAddress) return;
    const userAddr = userAddress.toLowerCase();

    // Player is joined if they're in the player list with monAmount > 0
    const inPlayerList = allPlayers.find(p => p.address.toLowerCase() === userAddr && p.monAmount > 0n);
    const isJoined = !!inPlayerList;

    // Update joined state
    setJoined(prevJoined => {
      if (prevJoined !== isJoined) {
        console.log(`🎮 Joined state updated: ${isJoined} for ${userAddr}`);
        console.log(`   Found in players list: ${!!inPlayerList}`);
        if (inPlayerList) {
          console.log(`   Player monAmount: ${inPlayerList.monAmount}`);
        }
      }
      return isJoined;
    });
  }, [allPlayers, userAddress]); // Removed playerJoinStates from dependencies to fix circular dependency


  return {
    allPlayers,
    joined,
    setJoined,  // Export setJoined for manual control
    minMonAmount,
    maxMonAmount,
    contractBoardWidth,
    contractBoardHeight,
    fetchAllPlayers,
    fullSyncFromContract,  // Export for manual refresh after actions
  };
}