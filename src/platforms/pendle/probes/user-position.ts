/**
 * User Position Probe (Pendle Platform)
 *
 * Monitors wallet holdings across Pendle markets
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { PendleApiClient } from '../services/pendle-api-client';

export interface UserPositionProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        walletAddress: string;
        chainId?: number;  // Optional: filter to specific chain
    };
    rules?: any[];
}

/**
 * User Position Probe - tracks wallet positions on Pendle
 *
 * Facts generated:
 * - pendle.totalValueUsd - Total USD value across all positions
 * - pendle.ptHoldings - Total PT value in USD
 * - pendle.ytHoldings - Total YT value in USD
 * - pendle.lpHoldings - Total LP value in USD
 * - pendle.claimableRewards - Total claimable rewards in USD
 * - pendle.positionCount - Number of active positions
 */
export class UserPositionProbe extends BaseProbe<UserPositionProbeConfig> {
    constructor(
        id: string,
        config: UserPositionProbeConfig,
        private readonly apiClient: PendleApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { walletAddress, chainId } = this.config.config;

        try {
            const dashboard = await this.apiClient.getUserDashboard(walletAddress);

            let positions = Array.isArray(dashboard) ? dashboard : (dashboard?.positions || []);

            // Filter by chain if specified
            if (chainId !== undefined) {
                positions = positions.filter((p: any) => p.chainId === chainId);
            }

            let totalValueUsd = 0;
            let ptHoldings = 0;
            let ytHoldings = 0;
            let lpHoldings = 0;
            let claimableRewards = 0;

            for (const position of positions) {
                const value = parseFloat(position.valueUsd || position.totalValueUsd || '0');
                totalValueUsd += value;

                if (position.ptValueUsd !== undefined) {
                    ptHoldings += parseFloat(position.ptValueUsd);
                }
                if (position.ytValueUsd !== undefined) {
                    ytHoldings += parseFloat(position.ytValueUsd);
                }
                if (position.lpValueUsd !== undefined) {
                    lpHoldings += parseFloat(position.lpValueUsd);
                }
                if (position.claimableRewardsUsd !== undefined) {
                    claimableRewards += parseFloat(position.claimableRewardsUsd);
                }
            }

            setFact(facts, 'pendle.totalValueUsd', totalValueUsd);
            setFact(facts, 'pendle.ptHoldings', ptHoldings);
            setFact(facts, 'pendle.ytHoldings', ytHoldings);
            setFact(facts, 'pendle.lpHoldings', lpHoldings);
            setFact(facts, 'pendle.claimableRewards', claimableRewards);
            setFact(facts, 'pendle.positionCount', positions.length);
            setFact(facts, 'pendle.walletAddress', walletAddress);
            setFact(facts, 'pendle.status', 'success');

        } catch (err) {
            console.error(`[UserPositionProbe:${this.id}] Failed to fetch user dashboard:`, err);
            setFact(facts, 'pendle.status', 'error');
            setFact(facts, 'pendle.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'pendle.totalValueUsd', null);
        }

        return facts;
    }
}
