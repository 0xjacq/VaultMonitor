/**
 * Polymarket API Client with Circuit Breaker
 * 
 * Wrapper for Polymarket CLOB API
 * Monitors prediction market odds and volumes
 */

import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface PolymarketApiClientConfig {
    baseUrl?: string;
    rateLimit?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * Polymarket API Client
 */
export class PolymarketApiClient {
    private baseUrl: string;
    private circuitBreaker: CircuitBreaker;
    private lastRequestTime = 0;
    private minRequestInterval: number;

    constructor(config: PolymarketApiClientConfig = {}) {
        this.baseUrl = config.baseUrl || 'https://clob.polymarket.com';

        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };
        this.circuitBreaker = new CircuitBreaker(cbConfig, 'PolymarketAPI');

        const rateLimit = config.rateLimit || 100;
        this.minRequestInterval = 60000 / rateLimit;
    }

    /**
     * Get market data
     * 
     * @param conditionId Market condition ID
     */
    async getMarket(conditionId: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/markets/${conditionId}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Market not found: ${conditionId}`);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get orderbook for a market
     * 
     * @param tokenId Token ID
     */
    async getOrderbook(tokenId: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/book?token_id=${tokenId}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get market trades (volume data)
     * 
     * @param conditionId Market condition ID
     */
    async getMarketTrades(conditionId: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/trades?condition_id=${conditionId}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get simplified market data (gamma API)
     * More reliable for basic price/odds data
     */
    async getSimplifiedMarket(slug: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `https://gamma-api.polymarket.com/markets/${slug}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    private async rateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    isHealthy(): boolean {
        return this.circuitBreaker.isHealthy();
    }

    getMetrics() {
        return this.circuitBreaker.getMetrics();
    }
}
