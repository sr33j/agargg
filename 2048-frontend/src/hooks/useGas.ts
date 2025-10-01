import { useState, useCallback } from 'react';
import { gasManager, GasUrgency, SimpleGasManager } from '../services/simpleGasManager';

interface GasParams {
  gasLimit: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
}

interface UseGasReturn {
  getGasParams: (txData: any, urgency?: GasUrgency) => Promise<GasParams>;
  estimateCost: (gasParams: GasParams) => string;
  isEstimating: boolean;
  lastEstimate: GasParams | null;
  error: string | null;
}

export function useGas(): UseGasReturn {
  const [isEstimating, setIsEstimating] = useState(false);
  const [lastEstimate, setLastEstimate] = useState<GasParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getGasParams = useCallback(async (
    txData: any,
    urgency?: GasUrgency
  ): Promise<GasParams> => {
    setIsEstimating(true);
    setError(null);

    try {
      // Auto-detect urgency if not provided
      const finalUrgency = urgency || SimpleGasManager.getRecommendedUrgency(
        txData.functionName || 'default'
      );

      const estimate = await gasManager.getGasParams(txData, finalUrgency);

      setLastEstimate(estimate);
      setIsEstimating(false);

      return estimate;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to estimate gas';
      setError(errorMsg);
      setIsEstimating(false);

      // Return fallback values on error
      console.error('Gas estimation error:', err);
      return {
        gasLimit: 500000n,
        maxPriorityFeePerGas: 1000000000n, // 1 gwei
        maxFeePerGas: 52000000000n // 52 gwei (50 base + 2 priority)
      };
    }
  }, []);

  const estimateCost = useCallback((gasParams: GasParams): string => {
    const cost = gasManager.calculateEstimatedCost(gasParams);
    return gasManager.formatCost(cost);
  }, []);

  return {
    getGasParams,
    estimateCost,
    isEstimating,
    lastEstimate,
    error
  };
}