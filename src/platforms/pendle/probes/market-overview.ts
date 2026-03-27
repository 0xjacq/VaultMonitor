/**
 * Market Overview Probe (Pendle Platform)
 *
 * Monitors protocol-wide market health using comprehensive V2 data
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PendleApiClient } from '../services/pendle-api-client';

export interface MarketOverviewProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        chainId?: number;       // Optional: filter to specific chain
        marketAddress?: string; // Optional: filter to specific market
    };
    rules?: any[];
}

/**
 * Market Overview Probe - tracks protocol-wide market metrics
 *
 * Facts generated:
 * - pendle.tvl - Total Value Locked in USD
 * - pendle.aggregatedApy - Combined APY including incentives
 * - pendle.pendleApy - Pendle-specific reward APY
 * - pendle.lpPrice - LP token price
 * - pendle.swapFee - Swap fee rate
 * - pendle.marketCount - Number of active markets
 */
export class MarketOverviewProbe extends BaseProbe<MarketOverviewProbeConfig> {
    constructor(
        id: string,
        config: MarketOverviewProbeConfig,
        private readonly apiClient: PendleApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, marketAddress } = this.config.config;

        try {
            const allMarkets = await this.apiClient.getAllMarketsV2();

            let markets = Array.isArray(allMarkets) ? allMarkets : (allMarkets?.results || allMarkets?.markets || []);

            // Filter by chain if specified
            if (chainId !== undefined) {
                markets = markets.filter((m: any) => m.chainId === chainId);
            }

            // Filter to specific market if specified
            if (marketAddress) {
                markets = markets.filter((m: any) =>
                    (m.address || m.marketAddress || '').toLowerCase() === marketAddress.toLowerCase()
                );
            }

            if (marketAddress && markets.length === 1) {
                // Single market mode — emit direct values
                const m = markets[0];
                if (m.tvl !== undefined) setFact(facts, 'pendle.tvl', parseFloat(m.tvl));
                if (m.aggregatedApy !== undefined) setFact(facts, 'pendle.aggregatedApy', parseFloat(m.aggregatedApy));
                if (m.pendleApy !== undefined) setFact(facts, 'pendle.pendleApy', parseFloat(m.pendleApy));
                if (m.lpPrice !== undefined) setFact(facts, 'pendle.lpPrice', parseFloat(m.lpPrice));
                if (m.swapFee !== undefined) setFact(facts, 'pendle.swapFee', parseFloat(m.swapFee));
            } else {
                // Aggregate mode — sum TVL, average APYs
                let totalTvl = 0;
                let totalAggApy = 0;
                let totalPendleApy = 0;
                let apyCount = 0;

                for (const m of markets) {
                    if (m.tvl !== undefined) totalTvl += parseFloat(m.tvl);
                    if (m.aggregatedApy !== undefined) {
                        totalAggApy += parseFloat(m.aggregatedApy);
                        apyCount++;
                    }
                    if (m.pendleApy !== undefined) {
                        totalPendleApy += parseFloat(m.pendleApy);
                    }
                }

                setFact(facts, 'pendle.tvl', totalTvl);
                if (apyCount > 0) {
                    setFact(facts, 'pendle.aggregatedApy', totalAggApy / apyCount);
                    setFact(facts, 'pendle.pendleApy', totalPendleApy / apyCount);
                }
            }

            setFact(facts, 'pendle.marketCount', markets.length);
            setFact(facts, 'pendle.status', 'success');

        } catch (err) {
            console.error(`[MarketOverviewProbe:${this.id}] Failed to fetch market overview:`, err);
            setFact(facts, 'pendle.status', 'error');
            setFact(facts, 'pendle.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'pendle.tvl', null);
        }

        return facts;
    }
}
