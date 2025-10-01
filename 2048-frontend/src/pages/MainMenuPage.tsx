import { useCallback } from 'react';
import { MainMenu } from '../components/MainMenu';
import { PlayerState } from '../types';
import { BlockNumberDisplay } from '../components/BlockNumberDisplay';

interface MainMenuPageProps {
  userAddress: string;
  privyProvider: any;
  allPlayers: PlayerState[];
  minMonAmount: bigint;
  maxMonAmount: bigint;
  contractBoardWidth: number;
  contractBoardHeight: number;
  setJoined: (value: boolean) => void;
  fullSyncFromContract: () => Promise<void>;
  onViewGame: () => void;
}

export function MainMenuPage({
  userAddress,
  privyProvider,
  allPlayers,
  minMonAmount,
  maxMonAmount,
  contractBoardWidth,
  contractBoardHeight,
  setJoined,
  fullSyncFromContract,
  onViewGame
}: MainMenuPageProps) {
  const handleJoinGame = useCallback(async (result: { success: boolean; txHash?: string }) => {
    console.log('🎮 Join game result:', result);

    if (result.success) {
      // Do full sync from contract to get updated state
      console.log('🔄 Refreshing state from contract after join...');
      await fullSyncFromContract();
      // The sync will update joined status based on contract state
    }
  }, [fullSyncFromContract]);

  return (
    <>
      <BlockNumberDisplay />
      <MainMenu
        userAddress={userAddress}
        privyProvider={privyProvider}
        allPlayers={allPlayers}
        minMonAmount={minMonAmount}
        maxMonAmount={maxMonAmount}
        contractBoardWidth={contractBoardWidth}
        contractBoardHeight={contractBoardHeight}
        onJoinGame={handleJoinGame}
        onViewGame={onViewGame}
      />
    </>
  );
}

export default MainMenuPage;