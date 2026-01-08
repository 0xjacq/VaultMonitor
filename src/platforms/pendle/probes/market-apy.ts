/**
 * Market APY Probe (Pendle Platform)
 * 
 * Monitors Pendle market APY (implied APY, underlying APY, etc.)
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PendleApiClient } from '../services/pendle-api-client';

export interface MarketApyProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        chainId: number;
        marketAddress: string;
    };
    rules?: any[];
}

/**
 * Market APY Probe - tracks Pendle market yields
 * 
 * Facts generated:
 * - pendle.impliedApy - Implied APY from PT trading
 * - pendle.underlyingApy - Underlying yield of the asset
 * - pendle.longYieldApy - Long YT APY
 * - pendle.ptPrice - PT token price
 * - pendle.ytPrice - YT token price
 */
export class MarketApyProbe extends BaseProbe<MarketApyProbeConfig> {
    constructor(
        id: string,
        config: MarketApyProbeConfig,
        private readonly apiClient: PendleApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, marketAddress } = this.config.config;

        try {
            const marketData = await this.apiClient.getMarketData(chainId, marketAddress);

            // Extract APY data
            if (marketData.impliedApy !== undefined) {
                setFact(facts, 'pendle.impliedApy', parseFloat(marketData.impliedApy));
            }

            if (marketData.underlyingApy !== undefined) {
                setFact(facts, 'pendle.underlyingApy', parseFloat(marketData.underlyingApy));
            }

            if (marketData.longYieldApy !== undefined) {
                setFact(facts, 'pendle.longYieldApy', parseFloat(marketData.longYieldApy));
            }

            // Extract price data
            if (marketData.ptPrice !== undefined) {
                setFact(facts, 'pendle.ptPrice', parseFloat(marketData.ptPrice));
            }

            if (marketData.ytPrice !== undefined) {
                setFact(facts, 'pendle.ytPrice', parseFloat(marketData.ytPrice));
            }

            // Store market address for reference
            setFact(facts, 'pendle.marketAddress', marketAddress);
            setFact(facts, 'pendle.chainId', chainId);
            setFact(facts, 'pendle.status', 'success');

        } catch (err) {
            console.error(`[MarketApyProbe:${this.id}] Failed to fetch market data:`, err);
            setFact(facts, 'pendle.status', 'error');
            setFact(facts, 'pendle.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'pendle.impliedApy', null);
        }

        return facts;
    }
}
