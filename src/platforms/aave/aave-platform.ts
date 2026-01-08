/**
 * Aave Platform
 * 
 * Platform adapter for Aave V3 lending protocol
 */

import { BasePlatform, PlatformMetadata, PlatformConfig } from '../base-platform';
import { BaseProbe } from '../../core/base-probe';
import { AaveApiClient } from './services/aave-api-client';
import { UserPositionProbe } from './probes/user-position';
import { LiquidationRiskProbe } from './probes/liquidation-risk';

export interface AavePlatformConfig extends PlatformConfig {
    chainIds?: number[];
    rateLimit?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * Aave Platform - supports position monitoring, liquidation risk tracking
 */
export class AavePlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'aave',
        name: 'Aave V3',
        version: '1.0.0',
        supportedProbeTypes: [
            'user_position',
            'liquidation_risk',
            // Future: 'reserve_data', 'market_rates'
        ],
    };

    private apiClient?: AaveApiClient;
    private platformConfig?: AavePlatformConfig;

    async initialize(config: PlatformConfig): Promise<void> {
        this.platformConfig = config as AavePlatformConfig;

        this.apiClient = new AaveApiClient({
            rateLimit: this.platformConfig.rateLimit || 60,
            circuitBreaker: this.platformConfig.circuitBreaker
        });

        console.log('[AavePlatform] Initialized');
        if (this.platformConfig.chainIds) {
            console.log(`[AavePlatform] Supported chains: ${this.platformConfig.chainIds.join(', ')}`);
        }
    }

    createProbe(type: string, config: any): BaseProbe {
        this.validateProbeType(type);

        if (!this.apiClient) {
            throw new Error('AavePlatform not initialized');
        }

        switch (type) {
            case 'user_position':
                return new UserPositionProbe(config.id, config, this.apiClient);
            case 'liquidation_risk':
                return new LiquidationRiskProbe(config.id, config, this.apiClient);
            default:
                throw new Error(`Aave probe type not implemented: ${type}`);
        }
    }

    async destroy(): Promise<void> {
        this.apiClient = undefined;
        console.log('[AavePlatform] Destroyed');
    }

    async healthCheck(): Promise<boolean> {
        return this.apiClient?.isHealthy() ?? false;
    }
}
