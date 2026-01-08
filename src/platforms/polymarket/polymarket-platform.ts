/**
 * Polymarket Platform
 * 
 * Platform adapter for Polymarket prediction markets
 * Supports both REST API and WebSocket real-time data
 */

import { BasePlatform, PlatformMetadata, PlatformConfig } from '../base-platform';
import { BaseProbe } from '../../core/base-probe';
import { PolymarketApiClient } from './services/polymarket-api-client';
import { PolymarketWebSocketClient } from './services/polymarket-websocket-client';
import { MarketOddsProbe } from './probes/market-odds';
import { VolumeProbe } from './probes/volume';
import { RealtimeMarketOddsProbe } from './probes/realtime-market-odds';

export interface PolymarketPlatformConfig extends PlatformConfig {
    rateLimit?: number;
    enableWebSocket?: boolean;  // Enable real-time WebSocket updates
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * Polymarket Platform - supports odds tracking, volume monitoring
 * Enhanced with WebSocket support for real-time data
 */
export class PolymarketPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'polymarket',
        name: 'Polymarket',
        version: '2.0.0',
        supportedProbeTypes: [
            'market_odds',           // REST API based
            'realtime_market_odds',  // WebSocket based (real-time)
            'volume',
            // Future: 'event_resolution', 'user_positions'
        ],
    };

    private apiClient?: PolymarketApiClient;
    private wsClient?: PolymarketWebSocketClient;
    private platformConfig?: PolymarketPlatformConfig;

    async initialize(config: PlatformConfig): Promise<void> {
        this.platformConfig = config as PolymarketPlatformConfig;

        // Always create REST API client
        this.apiClient = new PolymarketApiClient({
            rateLimit: this.platformConfig.rateLimit || 100,
            circuitBreaker: this.platformConfig.circuitBreaker
        });

        // Optionally create WebSocket client
        if (this.platformConfig.enableWebSocket !== false) {
            this.wsClient = new PolymarketWebSocketClient({
                circuitBreaker: this.platformConfig.circuitBreaker,
                autoConnect: true
            });
            console.log('[PolymarketPlatform] WebSocket enabled for real-time data');
        }

        console.log('[PolymarketPlatform] Initialized');
    }

    createProbe(type: string, config: any): BaseProbe {
        this.validateProbeType(type);

        switch (type) {
            case 'market_odds':
                if (!this.apiClient) {
                    throw new Error('PolymarketPlatform not initialized');
                }
                return new MarketOddsProbe(config.id, config, this.apiClient);

            case 'realtime_market_odds':
                if (!this.wsClient) {
                    throw new Error('WebSocket not enabled. Set enableWebSocket: true in platform config');
                }
                return new RealtimeMarketOddsProbe(config.id, config, this.wsClient);

            case 'volume':
                if (!this.apiClient) {
                    throw new Error('PolymarketPlatform not initialized');
                }
                return new VolumeProbe(config.id, config, this.apiClient);

            default:
                throw new Error(`Polymarket probe type not implemented: ${type}`);
        }
    }

    async destroy(): Promise<void> {
        if (this.wsClient) {
            await this.wsClient.disconnect();
        }
        this.apiClient = undefined;
        this.wsClient = undefined;
        console.log('[PolymarketPlatform] Destroyed');
    }

    async healthCheck(): Promise<boolean> {
        const apiHealthy = this.apiClient?.isHealthy() ?? true;
        const wsHealthy = this.wsClient?.isHealthy() ?? true;
        return apiHealthy && wsHealthy;
    }
}

