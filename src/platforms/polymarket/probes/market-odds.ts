/**
 * Market Odds Probe (Polymarket Platform)
 * 
 * Monitors prediction market odds/probabilities
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PolymarketApiClient } from '../services/polymarket-api-client';

export interface MarketOddsProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        marketSlug: string;    // e.g., "will-trump-win-2024"
        outcome: 'yes' | 'no'; // Which outcome to track
    };
    rules?: any[];
}

/**
 * Market Odds Probe - tracks prediction market probabilities
 * 
 * Facts generated:
 * - polymarket.probability - Current probability (0-1)
 * - polymarket.priceChange - Price change from previous check
 * - polymarket.volume24h - 24h trading volume
 * - polymarket.liquidity - Available liquidity
 */
export class MarketOddsProbe extends BaseProbe<MarketOddsProbeConfig> {
    constructor(
        id: string,
        config: MarketOddsProbeConfig,
        private readonly apiClient: PolymarketApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { marketSlug, outcome } = this.config.config;

        try {
            const market = await this.apiClient.getSimplifiedMarket(marketSlug);

            if (!market) {
                throw new Error('Market not found');
            }

            // Get current probability based on outcome
            let probability: number;
            if (outcome === 'yes') {
                probability = market.outcomePrices?.[0] || market.clobTokenIds?.[0]?.price || 0;
            } else {
                probability = market.outcomePrices?.[1] || market.clobTokenIds?.[1]?.price || 0;
            }

            setFact(facts, 'polymarket.probability', probability);
            setFact(facts, 'polymarket.probabilityPercent', probability * 100);

            // Calculate price change from previous state
            if (state.probe.last_probability !== undefined) {
                const priceChange = probability - Number(state.probe.last_probability);
                setFact(facts, 'polymarket.priceChange', priceChange);
                setFact(facts, 'polymarket.priceChangePercent', priceChange * 100);
            }

            // Store volume and liquidity if available
            if (market.volume24h !== undefined) {
                setFact(facts, 'polymarket.volume24h', parseFloat(market.volume24h));
            }

            if (market.liquidity !== undefined) {
                setFact(facts, 'polymarket.liquidity', parseFloat(market.liquidity));
            }

            // Store market info
            setFact(facts, 'polymarket.marketSlug', marketSlug);
            setFact(facts, 'polymarket.outcome', outcome);
            setFact(facts, 'polymarket.marketTitle', market.question || market.title);
            setFact(facts, 'polymarket.status', 'success');

            // Update state for next iteration
            state.probe = { ...state.probe, last_probability: probability };

        } catch (err) {
            console.error(`[MarketOddsProbe:${this.id}] Failed:`, err);
            setFact(facts, 'polymarket.status', 'error');
            setFact(facts, 'polymarket.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'polymarket.probability', null);
        }

        return facts;
    }
}
