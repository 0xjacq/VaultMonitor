/**
 * PT Discount Probe (Pendle Platform)
 *
 * Monitors PT discount to underlying and time to maturity
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PendleApiClient } from '../services/pendle-api-client';

export interface PtDiscountProbeConfig {
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
 * PT Discount Probe - tracks PT discount to underlying value
 *
 * Facts generated:
 * - pendle.ptDiscount - Discount of PT to underlying (e.g., 0.05 = 5%)
 * - pendle.daysToExpiry - Days until market maturity
 * - pendle.fixedApy - Effective fixed APY if holding PT to maturity
 */
export class PtDiscountProbe extends BaseProbe<PtDiscountProbeConfig> {
    constructor(
        id: string,
        config: PtDiscountProbeConfig,
        private readonly apiClient: PendleApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, marketAddress } = this.config.config;

        try {
            const historical = await this.apiClient.getHistoricalData(chainId, marketAddress);

            // Get the latest data point from the time series
            const results = Array.isArray(historical) ? historical : (historical?.results || historical?.data || []);
            const latest = results.length > 0 ? results[results.length - 1] : null;

            if (latest) {
                if (latest.ptDiscount !== undefined) {
                    setFact(facts, 'pendle.ptDiscount', parseFloat(latest.ptDiscount));
                }

                if (latest.impliedApy !== undefined) {
                    setFact(facts, 'pendle.fixedApy', parseFloat(latest.impliedApy));
                }

                // Calculate days to expiry from expiry timestamp
                if (latest.expiry !== undefined || historical?.expiry !== undefined) {
                    const expiry = latest.expiry || historical.expiry;
                    const expiryMs = typeof expiry === 'number' && expiry < 1e12 ? expiry * 1000 : expiry;
                    const daysToExpiry = Math.max(0, (expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
                    setFact(facts, 'pendle.daysToExpiry', Math.round(daysToExpiry * 100) / 100);
                }
            }

            setFact(facts, 'pendle.marketAddress', marketAddress);
            setFact(facts, 'pendle.chainId', chainId);
            setFact(facts, 'pendle.status', 'success');

        } catch (err) {
            console.error(`[PtDiscountProbe:${this.id}] Failed to fetch historical data:`, err);
            setFact(facts, 'pendle.status', 'error');
            setFact(facts, 'pendle.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'pendle.ptDiscount', null);
        }

        return facts;
    }
}
