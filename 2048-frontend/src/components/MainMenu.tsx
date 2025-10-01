import { useState, useEffect } from "react";
import { useLogout } from "@privy-io/react-auth";
import { publicClient } from "../utils/client";
import { BalanceDisplay } from "./BalanceDisplay";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";
import { JoinGameForm } from "./JoinGameForm";

interface MainMenuProps {
  userAddress: string;
  privyProvider: any;
  allPlayers: any[];
  minMonAmount: bigint;
  maxMonAmount: bigint;
  contractBoardWidth: number;
  contractBoardHeight: number;
  onJoinGame: (result: { success: boolean; txHash?: string }) => void;
  onViewGame: () => void;
}

export function MainMenu({
  userAddress,
  privyProvider,
  allPlayers,
  minMonAmount,
  maxMonAmount,
  contractBoardWidth,
  contractBoardHeight,
  onJoinGame,
  onViewGame
}: MainMenuProps) {
  const { logout } = useLogout();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [privyBalance, setPrivyBalance] = useState<bigint>(0n);

  useEffect(() => {
    const fetchBalance = async () => {
      // Guard against empty address
      if (!userAddress) {
        console.log('⚠️ Skipping balance fetch - no user address yet');
        return;
      }

      try {
        const bal = await publicClient.getBalance({
          address: userAddress as `0x${string}`
        });
        setPrivyBalance(bal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [userAddress]);

  const abbreviatedAddress = userAddress
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : "";

  const copyAddressToClipboard = async () => {
    if (userAddress) {
      try {
        await navigator.clipboard.writeText(userAddress);
        // You could add a toast notification here if needed
      } catch (error) {
        console.error('Failed to copy address:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = userAddress;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        padding: '0 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: 'white' }}>
          <BalanceDisplay address={userAddress} />
          <div 
            onClick={copyAddressToClipboard}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            title="Click to copy full address"
          >
            {abbreviatedAddress}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onViewGame}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: 'white',
              border: '2px solid white',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            View Game
          </button>

          <button
            onClick={() => setShowDepositModal(true)}
            style={{
              padding: '10px 24px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Deposit MON
          </button>

          <button
            onClick={() => setShowWithdrawModal(true)}
            style={{
              padding: '10px 24px',
              background: privyBalance > 0n ? 'white' : 'rgba(255,255,255,0.5)',
              color: privyBalance > 0n ? '#764ba2' : 'rgba(255,255,255,0.8)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: privyBalance > 0n ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              if (privyBalance > 0n) e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (privyBalance > 0n) e.currentTarget.style.transform = 'scale(1)';
            }}
            disabled={privyBalance === 0n}
          >
            Withdraw MON
          </button>

          <button
            onClick={() => logout()}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '40px',
        marginTop: '80px'
      }}>
        {/* Join Game Form - Center */}
        <JoinGameForm
          userAddress={userAddress}
          privyProvider={privyProvider}
          privyBalance={privyBalance}
          allPlayers={allPlayers}
          minMonAmount={minMonAmount}
          maxMonAmount={maxMonAmount}
          contractBoardWidth={contractBoardWidth}
          contractBoardHeight={contractBoardHeight}
          onSuccess={onJoinGame}
        />

        {/* Placeholder for balance/stats - Right Side */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          backdropFilter: 'blur(10px)',
          width: '300px',
          color: 'white'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Game Info</h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div>Players Online: {allPlayers.length}</div>
            <div>Network: Monad Testnet</div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <strong>How to Play:</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', listStyle: 'none' }}>
                <li style={{ marginBottom: '8px' }}>• Deposit your player's size into the game. The rest stays in your wallet for gas.</li>
                <li style={{ marginBottom: '8px' }}>• Collide with smaller players to absorb them and their funds.</li>
                <li>• Redeposit (r) more funds anytime, or leave (esc) to withdraw.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <DepositModal
          privyWalletAddress={userAddress}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            setShowDepositModal(false);
            // Balance will auto-update via the interval
          }}
        />
      )}
      
      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WithdrawModal
          privyWalletAddress={userAddress}
          privyProvider={privyProvider}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            // Balance will auto-update via the interval
          }}
        />
      )}
    </div>
  );
}