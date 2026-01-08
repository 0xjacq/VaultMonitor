/**
 * User Position Probe (Aave Platform)
 * 
 * Monitors Aave user positions (collateral, debt, health factor)
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { AaveApiClient } from '../services/aave-api-client';

export interface UserPositionProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        chainId: number;
        userAddress: string;
    };
    rules?: any[];
}

/**
 * User Position Probe - tracks Aave user positions
 * 
 * Facts generated:
 * - aave.healthFactor - Health factor (liquidation occurs < 1.0)
 * - aave.totalCollateralUSD - Total collateral in USD
 * - aave.totalDebtUSD - Total debt in USD
 * - aave.availableBorrowsUSD - Available to borrow
 * - aave.currentLTV - Current Loan-to-Value ratio
 * - aave.currentLiquidationThreshold
 */
export class UserPositionProbe extends BaseProbe<UserPositionProbeConfig> {
    constructor(
        id: string,
        config: UserPositionProbeConfig,
        private readonly apiClient: AaveApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, userAddress } = this.config.config;

        try {
            const position = await this.apiClient.getUserPosition(chainId, userAddress);

            if (!position) {
                // User has no position
                setFact(facts, 'aave.hasPosition', false);
                setFact(facts, 'aave.healthFactor', null);
                setFact(facts, 'aave.totalCollateralUSD', 0);
                setFact(facts, 'aave.totalDebtUSD', 0);
                return facts;
            }

            setFact(facts, 'aave.hasPosition', true);

            // Health factor (critical metric!)
            if (position.healthFactor !== undefined) {
                const healthFactor = parseFloat(position.healthFactor);
                setFact(facts, 'aave.healthFactor', healthFactor);
            }

            // Collateral and debt
            if (position.totalCollateralUSD !== undefined) {
                setFact(facts, 'aave.totalCollateralUSD', parseFloat(position.totalCollateralUSD));
            }

            if (position.totalDebtUSD !== undefined) {
                setFact(facts, 'aave.totalDebtUSD', parseFloat(position.totalDebtUSD));
            }

            if (position.availableBorrowsUSD !== undefined) {
                setFact(facts, 'aave.availableBorrowsUSD', parseFloat(position.availableBorrowsUSD));
            }

            // LTV metrics
            if (position.currentLTV !== undefined) {
                setFact(facts, 'aave.currentLTV', parseFloat(position.currentLTV));
            }

            if (position.currentLiquidationThreshold !== undefined) {
                setFact(facts, 'aave.currentLiquidationThreshold', parseFloat(position.currentLiquidationThreshold));
            }

            // Store user info
            setFact(facts, 'aave.userAddress', userAddress);
            setFact(facts, 'aave.chainId', chainId);
            setFact(facts, 'aave.status', 'success');

        } catch (err) {
            console.error(`[UserPositionProbe:${this.id}] Failed to fetch position:`, err);
            setFact(facts, 'aave.status', 'error');
            setFact(facts, 'aave.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'aave.healthFactor', null);
        }

        return facts;
    }
}
