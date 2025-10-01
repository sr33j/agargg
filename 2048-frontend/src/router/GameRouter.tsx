import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '../hooks/useWallet';
import { useWebSocketGameState } from '../hooks/useWebSocketGameState';

// Pages
import LandingPage from '../pages/LandingPage';
import MainMenuPage from '../pages/MainMenuPage';
import GamePage from '../pages/GamePage';
import ViewPage from '../pages/ViewPage';

export enum GameRouteState {
  LOADING = 'loading',
  LANDING = 'landing',
  MAIN_MENU = 'main_menu',
  IN_GAME = 'in_game',
  VIEW = 'view'
}

/**
 * Clean, reactive routing based on wallet and game state:
 * 
 * LANDING: User not connected to Privy wallet
 * MAIN_MENU: User connected but not in game  
 * IN_GAME: User connected and in game
 * LOADING: Brief transitions only
 */

export function GameRouter() {
  const { user, authenticated, ready: privyReady } = usePrivy();
  const { userAddress, privyProvider } = useWallet();
  const [isViewMode, setIsViewMode] = useState(false);

  // Get game state
  const {
    allPlayers,
    joined,
    setJoined,
    minMonAmount,
    maxMonAmount,
    contractBoardWidth,
    contractBoardHeight,
    fullSyncFromContract,
  } = useWebSocketGameState(userAddress);

  // Simple reactive routing - no overrides, no manual transitions
  const getCurrentRoute = (): GameRouteState => {
    // Check if in view mode first
    if (isViewMode) {
      return GameRouteState.VIEW;
    }

    // Still loading Privy SDK
    console.log("🔍 Privy ready:", privyReady);
    console.log("🔍 User:", user);
    console.log("🔍 Authenticated:", authenticated);
    console.log("🔍 User address:", userAddress);
    console.log("🔍 Privy provider:", privyProvider);
    console.log("🔍 Joined:", joined);
    
    if (!privyReady) {
      return GameRouteState.LOADING;
    }

    // Privy ready but user not connected/authenticated
    if (!user || !authenticated) {
      return GameRouteState.LANDING;
    }

    // User connected but not in game
    if (!joined) {
      return GameRouteState.MAIN_MENU;
    }

    // User connected and in game
    return GameRouteState.IN_GAME;
  };

  const currentRoute = getCurrentRoute();

  // Debug logging
  useEffect(() => {
    console.log(`📍 Route: ${currentRoute} (Wallet: ${!!userAddress}, Joined: ${joined})`);
  }, [currentRoute, userAddress, joined]);

  // Route to appropriate page
  switch (currentRoute) {
    case GameRouteState.LOADING:
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-5">
          <div className="text-lg">Initializing wallet connection...</div>
          <div className="text-sm text-gray-600">
            {!privyReady ? 'Setting up secure wallet...' : 'Creating game connection...'}
          </div>
        </div>
      );

    case GameRouteState.LANDING:
      return <LandingPage onViewGame={() => setIsViewMode(true)} />;

    case GameRouteState.MAIN_MENU:
      return (
        <MainMenuPage
          userAddress={userAddress}
          privyProvider={privyProvider}
          allPlayers={allPlayers}
          minMonAmount={minMonAmount}
          maxMonAmount={maxMonAmount}
          contractBoardWidth={contractBoardWidth}
          contractBoardHeight={contractBoardHeight}
          setJoined={setJoined}
          fullSyncFromContract={fullSyncFromContract}
          onViewGame={() => setIsViewMode(true)}
        />
      );

    case GameRouteState.IN_GAME:
      return (
        <GamePage
          userAddress={userAddress}
          allPlayers={allPlayers}
          contractBoardWidth={contractBoardWidth}
          contractBoardHeight={contractBoardHeight}
          privyProvider={privyProvider}
          setJoined={setJoined}
          fullSyncFromContract={fullSyncFromContract}
        />
      );

    case GameRouteState.VIEW:
      return <ViewPage onBackToGame={() => setIsViewMode(false)} />;

    default:
      return null;
  }
}

export default GameRouter;