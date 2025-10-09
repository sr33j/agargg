import { publicClient } from '../utils/client';
import { parseGwei } from 'viem';

export enum GasUrgency {
  ECONOMY = 'economy',    // Non-urgent, can wait
  STANDARD = 'standard',   // Normal operations
  FAST = 'fast',          // Urgent operations
  CRITICAL = 'critical'    // Must go through (withdrawals)
}

interface GasEstimate {
  gasLimit: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
}

interface CachedEstimate {
  estimate: GasEstimate;
  timestamp: number;
}

export class SimpleGasManager {
  private static instance: SimpleGasManager;
  private estimateCache: Map<string, CachedEstimate> = new Map();
  private readonly CACHE_DURATION = 10000; // 10 seconds
  private readonly MONAD_BASE_FEE = parseGwei('50'); // Monad's hardcoded base fee

  // Priority fee tiers (in gwei)
  private readonly PRIORITY_FEES = {
    [GasUrgency.ECONOMY]: parseGwei('0.5'),
    [GasUrgency.STANDARD]: parseGwei('1'),
    [GasUrgency.FAST]: parseGwei('5'),
    [GasUrgency.CRITICAL]: parseGwei('10')
  };

  // Buffer percentages for gas limits
  private readonly GAS_BUFFER = {
    [GasUrgency.ECONOMY]: 1.1,    // 10% buffer
    [GasUrgency.STANDARD]: 1.2,   // 20% buffer
    [GasUrgency.FAST]: 1.3,       // 30% buffer
    [GasUrgency.CRITICAL]: 1.5    // 50% buffer
  };

  private constructor() {}

  public static getInstance(): SimpleGasManager {
    if (!SimpleGasManager.instance) {
      SimpleGasManager.instance = new SimpleGasManager();
    }
    return SimpleGasManager.instance;
  }

  /**
   * Get gas parameters for a transaction
   */
  public async getGasParams(
    txData: any,
    urgency: GasUrgency = GasUrgency.STANDARD,
    useCache: boolean = true
  ): Promise<GasEstimate> {
    const cacheKey = this.getCacheKey(txData, urgency);

    // Check cache first
    if (useCache) {
      const cached = this.estimateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log('📊 Using cached gas estimate');
        return cached.estimate;
      }
    }

    try {
      // Estimate gas for the transaction
      const estimatedGas = await this.estimateGasLimit(txData);

      // Apply buffer based on urgency
      const buffer = this.GAS_BUFFER[urgency];
      const gasLimit = BigInt(Math.ceil(Number(estimatedGas) * buffer));

      // Get priority fee based on urgency
      const maxPriorityFeePerGas = this.PRIORITY_FEES[urgency];

      // Calculate max fee (base + priority with safety margin)
      const maxFeePerGas = this.MONAD_BASE_FEE + (maxPriorityFeePerGas * 2n);

      const estimate: GasEstimate = {
        gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas
      };

      // Cache the estimate
      this.estimateCache.set(cacheKey, {
        estimate,
        timestamp: Date.now()
      });

      console.log(`⛽ Gas estimate for ${urgency}:`, {
        gasLimit: gasLimit.toString(),
        priorityFee: `${Number(maxPriorityFeePerGas) / 1e9} gwei`,
        maxFee: `${Number(maxFeePerGas) / 1e9} gwei`,
        estimatedCost: `${Number(gasLimit * (this.MONAD_BASE_FEE + maxPriorityFeePerGas)) / 1e18} MON`
      });

      return estimate;
    } catch (error) {
      console.warn('Failed to estimate gas, using fallback values:', error);
      return this.getFallbackEstimate(urgency);
    }
  }

  /**
   * Get gas parameters with custom priority fee (for user-controlled gas)
   */
  public async getGasParamsWithCustomPriority(
    txData: any,
    priorityFeeGwei: number,
    useCache: boolean = true
  ): Promise<GasEstimate> {
    const cacheKey = `${txData.address}-${txData.functionName}-custom-${priorityFeeGwei}`;

    // Check cache first
    if (useCache) {
      const cached = this.estimateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log('📊 Using cached gas estimate (custom priority)');
        return cached.estimate;
      }
    }

    try {
      // Estimate gas for the transaction
      const estimatedGas = await this.estimateGasLimit(txData);

      // Use FAST buffer for custom priority transactions (30% buffer)
      const buffer = this.GAS_BUFFER[GasUrgency.FAST];
      const gasLimit = BigInt(Math.ceil(Number(estimatedGas) * buffer));

      // Convert gwei to wei
      const maxPriorityFeePerGas = parseGwei(priorityFeeGwei.toString());

      // Calculate max fee (base + priority with safety margin)
      const maxFeePerGas = this.MONAD_BASE_FEE + (maxPriorityFeePerGas * 2n);

      const estimate: GasEstimate = {
        gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas
      };

      // Cache the estimate
      this.estimateCache.set(cacheKey, {
        estimate,
        timestamp: Date.now()
      });

      console.log(`⛽ Gas estimate with custom priority (${priorityFeeGwei} gwei):`, {
        gasLimit: gasLimit.toString(),
        priorityFee: `${priorityFeeGwei} gwei`,
        maxFee: `${Number(maxFeePerGas) / 1e9} gwei`,
        estimatedCost: `${Number(gasLimit * (this.MONAD_BASE_FEE + maxPriorityFeePerGas)) / 1e18} MON`
      });

      return estimate;
    } catch (error) {
      console.warn('Failed to estimate gas, using fallback values:', error);
      // Return fallback with custom priority fee
      const maxPriorityFeePerGas = parseGwei(priorityFeeGwei.toString());
      return {
        gasLimit: 100000n,
        maxPriorityFeePerGas,
        maxFeePerGas: this.MONAD_BASE_FEE + (maxPriorityFeePerGas * 2n)
      };
    }
  }

  /**
   * Estimate gas limit for a transaction
   */
  private async estimateGasLimit(txData: any): Promise<bigint> {
    try {
      // For contract calls, use estimateContractGas
      if (txData.abi && txData.functionName) {
        const gas = await publicClient.estimateContractGas({
          address: txData.address,
          abi: txData.abi,
          functionName: txData.functionName,
          args: txData.args || [],
          value: txData.value,
          account: txData.account
        });
        return gas;
      }

      // For regular transactions
      return await publicClient.estimateGas(txData);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw error;
    }
  }

  /**
   * Get fallback gas estimates when estimation fails
   */
  private getFallbackEstimate(urgency: GasUrgency): GasEstimate {
    // Conservative fallback values
    const fallbackLimits: Record<string, bigint> = {
      move: 100000n,
      enter: 150000n,
      leave: 800000n,  // High for safety
      redeposit: 120000n,
      default: 200000n
    };

    return {
      gasLimit: fallbackLimits.default,
      maxPriorityFeePerGas: this.PRIORITY_FEES[urgency],
      maxFeePerGas: this.MONAD_BASE_FEE + (this.PRIORITY_FEES[urgency] * 2n)
    };
  }

  /**
   * Create cache key for gas estimates
   */
  private getCacheKey(txData: any, urgency: GasUrgency): string {
    const key = `${txData.address}-${txData.functionName}-${urgency}`;
    return key;
  }

  /**
   * Clear the gas estimate cache
   */
  public clearCache(): void {
    this.estimateCache.clear();
    console.log('🗑️ Gas estimate cache cleared');
  }

  /**
   * Get recommended urgency based on transaction type
   */
  public static getRecommendedUrgency(transactionType: string): GasUrgency {
    const urgencyMap: Record<string, GasUrgency> = {
      'move': GasUrgency.CRITICAL,
      'enter': GasUrgency.FAST,
      'leave': GasUrgency.FAST,
      'redeposit': GasUrgency.FAST,
      'collision': GasUrgency.CRITICAL
    };

    return urgencyMap[transactionType] || GasUrgency.STANDARD;
  }

  /**
   * Calculate estimated transaction cost in MON
   */
  public calculateEstimatedCost(gasEstimate: GasEstimate): bigint {
    // Use base fee + priority fee for estimation
    const effectiveFee = this.MONAD_BASE_FEE + gasEstimate.maxPriorityFeePerGas;
    return gasEstimate.gasLimit * effectiveFee;
  }

  /**
   * Format cost for display
   */
  public formatCost(costInWei: bigint): string {
    const costInMon = Number(costInWei) / 1e18;
    return costInMon.toFixed(6);
  }
}

// Export singleton instance
export const gasManager = SimpleGasManager.getInstance();