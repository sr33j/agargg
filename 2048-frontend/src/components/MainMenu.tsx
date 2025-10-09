import { useState } from "react";
import { useLogout } from "@privy-io/react-auth";
import { formatUnits } from "viem";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";
import { JoinGameForm } from "./JoinGameForm";
import { useBalance } from "../hooks/useBalance";
import { MON_DECIMALS } from "../constants";

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

const RECOMMENDED_GAS_RESERVE = 0.5; // MON

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
  
  // Use shared balance hook instead of local polling
  const { balance: privyBalance } = useBalance(userAddress);

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

  const balanceInMon = parseFloat(formatUnits(privyBalance, MON_DECIMALS));
  const hasNoBalance = balanceInMon === 0;
  const hasLowBalance = balanceInMon > 0 && balanceInMon < RECOMMENDED_GAS_RESERVE;
  const isReady = balanceInMon >= RECOMMENDED_GAS_RESERVE + parseFloat(formatUnits(minMonAmount, MON_DECIMALS));

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
        marginBottom: '20px',
        padding: '0 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              userSelect: 'none',
              color: 'white'
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

      {/* Wallet Flow Visualization */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto 40px',
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '16px' 
        }}>
          {/* Step 1: External Wallet */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: '#e0e7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}>
              🏦
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#667eea' }}>
              External Wallet
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Your main wallet
            </div>
          </div>

          {/* Arrow */}
          <div style={{ fontSize: '24px', color: '#667eea', marginTop: '-20px' }}>→</div>

          {/* Step 2: Embedded Wallet */}
          <div style={{ 
            flex: 1, 
            textAlign: 'center',
            padding: '16px',
            background: hasNoBalance ? '#fff3cd' : hasLowBalance ? '#fff3cd' : '#d4edda',
            borderRadius: '12px',
            border: `2px solid ${hasNoBalance ? '#ffc107' : hasLowBalance ? '#ffc107' : '#28a745'}`
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: hasNoBalance ? '#fff' : hasLowBalance ? '#fff' : '#c3e6cb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}>
              💳
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#333' }}>
              Embedded Wallet
            </div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: hasNoBalance ? '#856404' : hasLowBalance ? '#856404' : '#155724',
              marginBottom: '8px'
            }}>
              {balanceInMon.toFixed(4)} MON
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
              <button
                onClick={() => setShowDepositModal(true)}
                style={{
                  padding: '8px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Deposit
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={privyBalance === 0n}
                style={{
                  padding: '8px 16px',
                  background: privyBalance > 0n ? '#764ba2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
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
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ fontSize: '24px', color: '#667eea', marginTop: '-20px' }}>→</div>

          {/* Step 3: Game */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: isReady ? '#d4edda' : '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}>
              🎮
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#667eea' }}>
              In Game
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Your game balance
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e0e0e0' }}>
          {hasNoBalance && (
            <div style={{
              padding: '12px 16px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              color: '#856404',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <strong>Step 1:</strong> Deposit MON from your external wallet to your embedded wallet above
              </div>
            </div>
          )}
          {hasLowBalance && (
            <div style={{
              padding: '12px 16px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              color: '#856404',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div>
                <strong>Low Balance:</strong> You have {balanceInMon.toFixed(4)} MON. Recommend at least {RECOMMENDED_GAS_RESERVE} MON for gas + game entry
              </div>
            </div>
          )}
          {isReady && (
            <div style={{
              padding: '12px 16px',
              background: '#d4edda',
              border: '1px solid #28a745',
              borderRadius: '8px',
              color: '#155724',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <div>
                <strong>Ready to play!</strong> You have sufficient balance. Enter the game below.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '40px',
        marginTop: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
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
          recommendedGasReserve={RECOMMENDED_GAS_RESERVE}
        />

        {/* Game Info - Right Side */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          width: '320px',
          color: '#333'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', color: '#667eea', fontWeight: 'bold' }}>
            How to Play
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e0e0e0' }}>
              <strong style={{ color: '#667eea' }}>Getting Started:</strong>
              <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li style={{ marginBottom: '8px' }}>
                  Deposit MON to your embedded wallet
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Keep at least <strong>{RECOMMENDED_GAS_RESERVE} MON</strong> for gas fees
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Enter the game with remaining balance
                </li>
              </ol>
            </div>
            
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e0e0e0' }}>
              <strong style={{ color: '#667eea' }}>Gameplay:</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', listStyle: 'none' }}>
                <li style={{ marginBottom: '8px' }}>• Move with arrow keys or WASD</li>
                <li style={{ marginBottom: '8px' }}>• Collide with smaller players to absorb them</li>
                <li style={{ marginBottom: '8px' }}>• Grow bigger and earn their MON</li>
              </ul>
            </div>
            
            <div>
              <strong style={{ color: '#667eea' }}>Controls:</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', listStyle: 'none' }}>
                <li style={{ marginBottom: '8px' }}>• <strong>R</strong> - Deposit more MON</li>
                <li style={{ marginBottom: '8px' }}>• <strong>ESC</strong> - Leave & withdraw</li>
              </ul>
            </div>
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0', fontSize: '13px', color: '#666' }}>
              <div><strong>Players Online:</strong> {allPlayers.length}</div>
              <div><strong>Network:</strong> Monad Testnet</div>
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