/**
 * Liquidation Risk Probe (Aave Platform)
 * 
 * Monitors liquidation risk for Aave positions
 * Triggers alerts when health factor is approaching liquidation threshold
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { AaveApiClient } from '../services/aave-api-client';

export interface LiquidationRiskProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        chainId: number;
        userAddress: string;
        warningThreshold?: number;  // Default: 1.5 (50% buffer above liquidation)
        criticalThreshold?: number; // Default: 1.2 (20% buffer)
    };
    rules?: any[];
}

/**
 * Liquidation Risk Probe - monitors risk of liquidation
 * 
 * Facts generated:
 * - aave.riskLevel - 'safe', 'warning', 'critical', 'danger'
 * - aave.distanceToLiquidation - Distance from liquidation (health factor - 1.0)
 * - aave.recommendedAction - Suggested action for user
 */
export class LiquidationRiskProbe extends BaseProbe<LiquidationRiskProbeConfig> {
    constructor(
        id: string,
        config: LiquidationRiskProbeConfig,
        private readonly apiClient: AaveApiClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};
        const { chainId, userAddress, warningThreshold = 1.5, criticalThreshold = 1.2 } = this.config.config;

        try {
            const position = await this.apiClient.getUserPosition(chainId, userAddress);

            if (!position || !position.healthFactor) {
                setFact(facts, 'aave.riskLevel', 'no_position');
                setFact(facts, 'aave.distanceToLiquidation', null);
                return facts;
            }

            const healthFactor = parseFloat(position.healthFactor);
            const distanceToLiquidation = healthFactor - 1.0;

            setFact(facts, 'aave.healthFactor', healthFactor);
            setFact(facts, 'aave.distanceToLiquidation', distanceToLiquidation);

            // Determine risk level
            let riskLevel: string;
            let recommendedAction: string;

            if (healthFactor < 1.0) {
                riskLevel = 'liquidated';
                recommendedAction = 'Position is being liquidated!';
            } else if (healthFactor < 1.05) {
                riskLevel = 'danger';
                recommendedAction = 'URGENT: Add collateral or repay debt immediately!';
            } else if (healthFactor < criticalThreshold) {
                riskLevel = 'critical';
                recommendedAction = 'WARNING: Add collateral or repay debt soon';
            } else if (healthFactor < warningThreshold) {
                riskLevel = 'warning';
                recommendedAction = 'Monitor position closely';
            } else {
                riskLevel = 'safe';
                recommendedAction = 'Position is healthy';
            }

            setFact(facts, 'aave.riskLevel', riskLevel);
            setFact(facts, 'aave.recommendedAction', recommendedAction);

            // Calculate metrics
            if (position.totalCollateralUSD && position.totalDebtUSD) {
                const collateral = parseFloat(position.totalCollateralUSD);
                const debt = parseFloat(position.totalDebtUSD);

                // How much collateral can be withdrawn safely
                const safeCollateral = collateral - (debt * warningThreshold);
                setFact(facts, 'aave.safeWithdrawableUSD', Math.max(0, safeCollateral));

                // How much debt can be added safely
                const safeDebt = (collateral / warningThreshold) - debt;
                setFact(facts, 'aave.safeBorrowableUSD', Math.max(0, safeDebt));
            }

            setFact(facts, 'aave.userAddress', userAddress);
            setFact(facts, 'aave.chainId', chainId);
            setFact(facts, 'aave.status', 'success');

        } catch (err) {
            console.error(`[LiquidationRiskProbe:${this.id}] Failed:`, err);
            setFact(facts, 'aave.status', 'error');
            setFact(facts, 'aave.error', err instanceof Error ? err.message : String(err));
            setFact(facts, 'aave.riskLevel', 'unknown');
        }

        return facts;
    }
}
