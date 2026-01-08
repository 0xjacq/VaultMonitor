/**
 * Pool Liquidity Probe (Pendle Platform)
 * 
 * Monitors Pendle pool liquidity and volume
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PendleApiClient } from '../services/pendle-api-client';

export interface PoolLiquidityProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        chainId: number;
        poolAddress: string;
    };
    rules?: any[];
}

/**
 * Pool Liquidity Probe - tracks Pendle pool metrics
 * 
 * Facts generated:
 * - pendle.totalLiquidity - Total liquidity in USD
 * - pendle.volume24h - 24h trading volume
 * - pendle.volumeChange - Volume change percentage
 * - pendle.liquidityChange - Liquidity change percentage
 */
export class PoolLiquidityProbe extends BaseProbe<PoolLiquidityProbeConfig> {
    constructor(
        id: string,
        config: PoolLiquidityProbeConfig,
        private readonly apiClient: PendleApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, poolAddress } = this.config.config;

        try {
            const poolData = await this.apiClient.getPoolData(chainId, poolAddress);

            // Extract liquidity data
            if (poolData.totalLiquidity !== undefined) {
                setFact(facts, 'pendle.totalLiquidity', parseFloat(poolData.totalLiquidity));
            }

            if (poolData.volume24h !== undefined) {
                setFact(facts, 'pendle.volume24h', parseFloat(poolData.volume24h));
            }

            if (poolData.volumeChange !== undefined) {
                setFact(facts, 'pendle.volumeChange', parseFloat(poolData.volumeChange));
            }

            if (poolData.liquidityChange !== undefined) {
                setFact(facts, 'pendle.liquidityChange', parseFloat(poolData.liquidityChange));
            }

            // Store pool info
            setFact(facts, 'pendle.poolAddress', poolAddress);
            setFact(facts, 'pendle.chainId', chainId);
            setFact(facts, 'pendle.status', 'success');

        } catch (err) {
            console.error(`[PoolLiquidityProbe:${this.id}] Failed to fetch pool data:`, err);
            setFact(facts, 'pendle.status', 'error');
            setFact(facts, 'pendle.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'pendle.totalLiquidity', null);
        }

        return facts;
    }
}
