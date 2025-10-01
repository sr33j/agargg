import { useCallback } from 'react';
import { AgarioGame } from '../components/game/AgarioGame';
import { PlayerState } from '../types';
import { BlockNumberDisplay } from '../components/BlockNumberDisplay';
import { TransactionNotifications } from '../components/TransactionNotifications';

interface GamePageProps {
  userAddress: string;
  allPlayers: PlayerState[];
  contractBoardWidth: number;
  contractBoardHeight: number;
  privyProvider: any;
  setJoined: (value: boolean) => void;
  fullSyncFromContract: () => Promise<void>;
}

export function GamePage({
  userAddress,
  allPlayers,
  contractBoardWidth,
  contractBoardHeight,
  privyProvider,
  setJoined,
  fullSyncFromContract
}: GamePageProps) {
  const handleLeaveComplete = useCallback(async () => {
    console.log('🚪 Leave game complete, syncing from contract...');
    // Do full sync to get updated state from contract
    await fullSyncFromContract();
  }, [fullSyncFromContract]);

  return (
    <>
      <BlockNumberDisplay />
      <TransactionNotifications />
      <AgarioGame
        userAddress={userAddress}
        allPlayers={allPlayers}
        contractBoardWidth={contractBoardWidth}
        contractBoardHeight={contractBoardHeight}
        privyProvider={privyProvider}
        onLeaveComplete={handleLeaveComplete}
        setJoined={setJoined}
        fullSyncFromContract={fullSyncFromContract}
      />
    </>
  );
}

export default GamePage;