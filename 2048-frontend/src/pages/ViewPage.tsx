import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { PlayerState } from '../types';
import { GameCanvas } from '../components/game/GameCanvas';
import { BlockNumberDisplay } from '../components/BlockNumberDisplay';
import { publicClient } from '../utils/client';
import AgarGameAbi from '../contracts/abi/AgarGame.json';
import { AGAR_GAME_ADDRESS } from '../constants';
import { WEBSOCKET_URL } from '../config/urls';

interface ViewPageProps {
  onBackToGame: () => void;
}

export function ViewPage({ onBackToGame }: ViewPageProps) {
  const [allPlayers, setAllPlayers] = useState<PlayerState[]>([]);
  const [contractBoardWidth, setContractBoardWidth] = useState<number>(20000);
  const [contractBoardHeight, setContractBoardHeight] = useState<number>(20000);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch board dimensions from contract
  useEffect(() => {
    async function fetchBoardDimensions() {
      try {
        const [width, height] = await Promise.all([
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'boardWidth',
          }) as Promise<bigint>,
          publicClient.readContract({
            address: AGAR_GAME_ADDRESS,
            abi: AgarGameAbi,
            functionName: 'boardHeight',
          }) as Promise<bigint>,
        ]);

        setContractBoardWidth(Number(width));
        setContractBoardHeight(Number(height));
      } catch (error) {
        console.error('Failed to fetch board dimensions:', error);
      }
    }

    fetchBoardDimensions();
  }, []);

  // Connect to WebSocket for real-time game state
  useEffect(() => {
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('🔗 Connected to view WebSocket');
      setIsConnected(true);

      // Request full game state on connect
      socket.emit('request-sync');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from view WebSocket');
      setIsConnected(false);
    });

    // Listen for full game state updates
    socket.on('full-sync', (players: any[]) => {
      console.log('📦 Received game state with', players.length, 'players');
      // Convert the data to proper PlayerState format
      const formattedPlayers: PlayerState[] = players.map(p => ({
        address: p.address,
        monAmount: BigInt(p.monAmount),
        x: BigInt(p.x),
        y: BigInt(p.y)
      }));
      setAllPlayers(formattedPlayers);
    });

    // Listen for player entered events
    socket.on('player-entered', (data: any) => {
      const player: PlayerState = {
        address: data.address,
        monAmount: BigInt(data.monAmount),
        x: BigInt(data.x),
        y: BigInt(data.y)
      };
      setAllPlayers(prev => {
        const exists = prev.some(p => p.address.toLowerCase() === player.address.toLowerCase());
        if (!exists) {
          return [...prev, player];
        }
        return prev;
      });
    });

    // Listen for player moved events
    socket.on('player-moved', (data: any) => {
      const player: PlayerState = {
        address: data.address,
        monAmount: BigInt(data.monAmount),
        x: BigInt(data.x),
        y: BigInt(data.y)
      };
      setAllPlayers(prev => {
        const index = prev.findIndex(p => p.address.toLowerCase() === player.address.toLowerCase());
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = player;
          return updated;
        }
        return prev;
      });
    });

    // Listen for player left events
    socket.on('player-left', (data: { address: string }) => {
      setAllPlayers(prev => prev.filter(p => p.address.toLowerCase() !== data.address.toLowerCase()));
    });

    // Request game state periodically
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit('request-sync');
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <BlockNumberDisplay />

      {/* Header - Responsive layout */}
      <div className="bg-white shadow-sm p-2 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <h1 className="text-lg sm:text-2xl font-bold">Spectator Mode</h1>
          <span className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-xs sm:text-sm text-gray-600">
            Players: <span className="font-semibold">{allPlayers.length}</span>
          </div>

          <button
            onClick={onBackToGame}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Back to Game
          </button>
        </div>
      </div>

      {/* Game Canvas - Responsive container */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 lg:p-8 min-h-0">
        {allPlayers.length > 0 ? (
          <GameCanvas
            allPlayers={allPlayers}
            currentPlayerAddress=""
            optimisticPosition={null}
            queuedMoves={[]}
            contractBoardWidth={contractBoardWidth}
            contractBoardHeight={contractBoardHeight}
          />
        ) : (
          <div className="text-center p-4">
            <div className="text-xl sm:text-2xl text-gray-400 mb-2">No players in game</div>
            <div className="text-xs sm:text-sm text-gray-500">Waiting for players to join...</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewPage;