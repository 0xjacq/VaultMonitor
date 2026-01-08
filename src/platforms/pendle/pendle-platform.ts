/**
 * Pendle Platform
 * 
 * Platform adapter for Pendle Finance - DeFi yield trading protocol
 */

import { BasePlatform, PlatformMetadata, PlatformConfig } from '../base-platform';
import { BaseProbe } from '../../core/base-probe';
import { PendleApiClient } from './services/pendle-api-client';
import { MarketApyProbe } from './probes/market-apy';
import { PoolLiquidityProbe } from './probes/pool-liquidity';

export interface PendlePlatformConfig extends PlatformConfig {
    chainIds?: number[];  // Supported chain IDs
    rateLimit?: number;   // API rate limit
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * Pendle Platform - supports market APY tracking, pool liquidity monitoring
 */
export class PendlePlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'pendle',
        name: 'Pendle Finance',
        version: '1.0.0',
        supportedProbeTypes: [
            'market_apy',
            'pool_liquidity',
            // Future: 'user_position', 'pt_price', 'yt_price'
        ],
    };

    private apiClient?: PendleApiClient;
    private platformConfig?: PendlePlatformConfig;

    async initialize(config: PlatformConfig): Promise<void> {
        this.platformConfig = config as PendlePlatformConfig;

        // Create API client
        this.apiClient = new PendleApiClient({
            rateLimit: this.platformConfig.rateLimit || 50,
            circuitBreaker: this.platformConfig.circuitBreaker
        });

        console.log('[PendlePlatform] Initialized');
        if (this.platformConfig.chainIds) {
            console.log(`[PendlePlatform] Supported chains: ${this.platformConfig.chainIds.join(', ')}`);
        }
    }

    createProbe(type: string, config: any): BaseProbe {
        this.validateProbeType(type);

        if (!this.apiClient) {
            throw new Error('PendlePlatform not initialized');
        }

        switch (type) {
            case 'market_apy':
                return new MarketApyProbe(config.id, config, this.apiClient);
            case 'pool_liquidity':
                return new PoolLiquidityProbe(config.id, config, this.apiClient);
            default:
                throw new Error(`Pendle probe type not implemented: ${type}`);
        }
    }

    async destroy(): Promise<void> {
        this.apiClient = undefined;
        console.log('[PendlePlatform] Destroyed');
    }

    async healthCheck(): Promise<boolean> {
        return this.apiClient?.isHealthy() ?? false;
    }
}
