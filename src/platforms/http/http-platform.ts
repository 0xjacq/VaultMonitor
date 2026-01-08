/**
 * HTTP Platform
 * 
 * Platform adapter for generic HTTP/REST API probes.
 */

import { BasePlatform, PlatformMetadata, PlatformConfig } from '../base-platform';
import { BaseProbe } from '../../core/base-probe';
import { HttpClient } from './services/http-client';
import { GenericApiProbe } from './probes/generic-api';

export interface HttpPlatformConfig extends PlatformConfig {
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * HTTP Platform - supports generic API calls
 */
export class HttpPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'http',
        name: 'HTTP/REST API',
        version: '1.0.0',
        supportedProbeTypes: [
            'generic_api',
            // Future: 'rest_poller', 'graphql_query'
        ],
    };

    private httpClients = new Map<string, HttpClient>();
    private platformConfig?: HttpPlatformConfig;

    async initialize(config: PlatformConfig): Promise<void> {
        this.platformConfig = config as HttpPlatformConfig;
        console.log('[HttpPlatform] Initialized');
    }

    createProbe(type: string, config: any): BaseProbe {
        this.validateProbeType(type);

        switch (type) {
            case 'generic_api':
                return new GenericApiProbe(
                    config.id,
                    config,
                    this.getOrCreateHttpClient(config.config.url)
                );
            default:
                throw new Error(`HTTP probe type not implemented: ${type}`);
        }
    }

    async destroy(): Promise<void> {
        this.httpClients.clear();
        console.log('[HttpPlatform] Destroyed');
    }

    async healthCheck(): Promise<boolean> {
        // Platform is healthy if at least one client is healthy
        for (const client of this.httpClients.values()) {
            if (client.isHealthy()) {
                return true;
            }
        }

        return this.httpClients.size === 0;
    }

    /**
     * Get or create HTTP client for a base URL
     */
    private getOrCreateHttpClient(url: string): HttpClient {
        // Extract base URL (domain) to share clients
        const baseUrl = this.getBaseUrl(url);

        if (!this.httpClients.has(baseUrl)) {
            const client = new HttpClient({
                timeout: 10000,
                circuitBreaker: this.platformConfig?.circuitBreaker
            }, `HTTP:${baseUrl}`);

            this.httpClients.set(baseUrl, client);
            console.log(`[HttpPlatform] Created HTTP client for ${baseUrl}`);
        }

        return this.httpClients.get(baseUrl)!;
    }

    private getBaseUrl(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.hostname;
        } catch {
            return 'default';
        }
    }
}
