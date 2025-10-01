import React, { useState } from 'react';
import { formatUnits } from 'viem';
import { MON_DECIMALS } from '../../constants';

interface GameControlsProps {
  onLeave: () => void;
  onRedeposit: () => void;
  isWithdrawing: boolean;
  walletBalance: bigint;
  playerMonAmount: bigint;
  error: string | null;
  progress: string | null;
  userAddress?: string;
}

export function GameControls({
  onLeave,
  onRedeposit,
  isWithdrawing,
  walletBalance,
  playerMonAmount,
  error,
  progress,
  userAddress
}: GameControlsProps) {
  const [copied, setCopied] = useState(false);
  const walletBalanceInMon = Number(formatUnits(walletBalance, MON_DECIMALS));
  const playerBalanceInMon = Number(formatUnits(playerMonAmount, MON_DECIMALS));

  const getJuiceColor = (balance: number) => {
    if (balance < 0.25) return '#ef4444'; // red
    if (balance < 1) return '#f59e0b'; // orange
    return '#10b981'; // green
  };

  const copyAddress = async () => {
    if (userAddress) {
      await navigator.clipboard.writeText(userAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-lg">
      {/* Wallet Address Display */}
      {userAddress && (
        <div className="p-2 bg-gray-50 rounded-md">
          <div className="text-xs text-gray-500 mb-1">Embedded Wallet</div>
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors"
            onClick={copyAddress}
          >
            <span className="font-mono text-xs break-all">
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
            <span className="text-xs text-gray-400">
              {copied ? '✓ Copied' : '📋'}
            </span>
          </div>
        </div>
      )}

      {/* Balance Display with Juice Indicator */}
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-gray-600">Wallet:</span>
          <span
            className="ml-2 font-semibold"
            style={{ color: getJuiceColor(walletBalanceInMon) }}
          >
            {walletBalanceInMon.toFixed(4)} MON
            {walletBalanceInMon < 0.25 && ' ⚠️'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">In Game:</span>
          <span className="ml-2 font-semibold">{playerBalanceInMon.toFixed(4)} MON</span>
        </div>
      </div>

      {/* Juice Warning */}
      {walletBalanceInMon < 0.25 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠️ Low wallet balance! You may not have enough gas for transactions.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onLeave}
          disabled={isWithdrawing}
          className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isWithdrawing ? 'Withdrawing...' : 'Leave Game'}
        </button>

        <button
          onClick={onRedeposit}
          disabled={isWithdrawing || walletBalance === 0n}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Redeposit
        </button>
      </div>

      {/* Status Messages */}
      {progress && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          {progress}
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls Help */}
      <div className="text-xs text-gray-500 border-t pt-2">
        <div className="font-semibold mb-1">Controls:</div>
        <div>Arrow Keys or WASD to move</div>
        <div>R - Redeposit</div>
        <div>ESC - Leave Game</div>
      </div>
    </div>
  );
}

export default GameControls;