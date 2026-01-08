/**
 * Volume Probe (Polymarket Platform)
 * 
 * Monitors trading volume spikes on prediction markets
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PolymarketApiClient } from '../services/polymarket-api-client';

export interface VolumeProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        marketSlug: string;
    };
    rules?: any[];
}

/**
 * Volume Probe - tracks volume spikes indicating high activity
 * 
 * Facts generated:
 * - polymarket.volume24h - 24h volume
 * - polymarket.volumeChange - Volume change from previous check
 * - polymarket.activityLevel - 'low', 'normal', 'high', 'spike'
 */
export class VolumeProbe extends BaseProbe<VolumeProbeConfig> {
    constructor(
        id: string,
        config: VolumeProbeConfig,
        private readonly apiClient: PolymarketApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { marketSlug } = this.config.config;

        try {
            const market = await this.apiClient.getSimplifiedMarket(marketSlug);

            if (!market) {
                throw new Error('Market not found');
            }

            const volume24h = parseFloat(market.volume24h || '0');
            setFact(facts, 'polymarket.volume24h', volume24h);

            // Calculate volume change
            if (state.probe.last_volume !== undefined) {
                const lastVolume = Number(state.probe.last_volume);
                const volumeChange = volume24h - lastVolume;
                const volumeChangePercent = lastVolume > 0
                    ? (volumeChange / lastVolume) * 100
                    : 0;

                setFact(facts, 'polymarket.volumeChange', volumeChange);
                setFact(facts, 'polymarket.volumeChangePercent', volumeChangePercent);

                // Determine activity level
                let activityLevel: string;
                if (volumeChangePercent > 100) {
                    activityLevel = 'spike';  // > 100% increase
                } else if (volumeChangePercent > 50) {
                    activityLevel = 'high';   // 50-100% increase
                } else if (volumeChangePercent > 0) {
                    activityLevel = 'normal'; // Positive growth
                } else {
                    activityLevel = 'low';    // Declining
                }

                setFact(facts, 'polymarket.activityLevel', activityLevel);
            }

            // Store market info
            setFact(facts, 'polymarket.marketSlug', marketSlug);
            setFact(facts, 'polymarket.marketTitle', market.question || market.title);
            setFact(facts, 'polymarket.status', 'success');

            // Update state
            state.probe = { ...state.probe, last_volume: volume24h };

        } catch (err) {
            console.error(`[VolumeProbe:${this.id}] Failed:`, err);
            setFact(facts, 'polymarket.status', 'error');
            setFact(facts, 'polymarket.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'polymarket.volume24h', null);
        }

        return facts;
    }
}
