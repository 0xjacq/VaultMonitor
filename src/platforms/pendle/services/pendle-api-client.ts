/**
 * Pendle API Client with Circuit Breaker and Rate Limiting
 * 
 * Wrapper for Pendle Finance V2 API
 * https://api-v2.pendle.finance/
 */

import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface PendleApiClientConfig {
    baseUrl?: string;
    rateLimit?: number;  // Max requests per minute
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

interface RateLimiter {
    timestamps: number[];
    maxRequests: number;
    windowMs: number;
}

/**
 * Pendle API Client with resilience patterns
 */
export class PendleApiClient {
    private baseUrl: string;
    private circuitBreaker: CircuitBreaker;
    private rateLimiter: RateLimiter;

    constructor(config: PendleApiClientConfig = {}) {
        this.baseUrl = config.baseUrl || 'https://api-v2.pendle.finance';

        // Initialize circuit breaker
        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };
        this.circuitBreaker = new CircuitBreaker(cbConfig, 'PendleAPI');

        // Initialize rate limiter
        this.rateLimiter = {
            timestamps: [],
            maxRequests: config.rateLimit || 50,  // 50 req/min by default
            windowMs: 60000  // 1 minute
        };
    }

    /**
     * Get market data (swapping prices, APY, etc.)
     * 
     * @param chainId Chain ID (1 = Ethereum, 42161 = Arbitrum, etc.)
     * @param marketAddress Market contract address
     */
    async getMarketData(chainId: number, marketAddress: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/core/v1/sdk/${chainId}/markets/${marketAddress}/swapping-prices`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limited by Pendle API');
                } else if (response.status >= 500) {
                    throw new Error(`Pendle API server error: ${response.status}`);
                } else if (response.status === 404) {
                    throw new Error(`Market not found: ${marketAddress} on chain ${chainId}`);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get all markets for a chain
     * 
     * @param chainId Chain ID
     */
    async getMarkets(chainId: number): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/core/v1/sdk/${chainId}/markets`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get pool data (liquidity, volume, etc.)
     * 
     * @param chainId Chain ID
     * @param poolAddress Pool contract address
     */
    async getPoolData(chainId: number, poolAddress: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/core/v1/sdk/${chainId}/pools/${poolAddress}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Rate limiting - wait if necessary
     */
    private async rateLimit(): Promise<void> {
        const now = Date.now();

        // Remove timestamps outside the window
        this.rateLimiter.timestamps = this.rateLimiter.timestamps.filter(
            ts => now - ts < this.rateLimiter.windowMs
        );

        // If at limit, wait
        if (this.rateLimiter.timestamps.length >= this.rateLimiter.maxRequests) {
            const oldestTimestamp = this.rateLimiter.timestamps[0];
            const waitMs = this.rateLimiter.windowMs - (now - oldestTimestamp) + 100;

            if (waitMs > 0) {
                console.log(`[PendleApiClient] Rate limit reached, waiting ${waitMs}ms`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }

            // Recurse to check again
            return this.rateLimit();
        }

        // Record this request
        this.rateLimiter.timestamps.push(now);
    }

    /**
     * Fetch with timeout
     */
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

    /**
     * Check if client is healthy
     */
    isHealthy(): boolean {
        return this.circuitBreaker.isHealthy();
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return {
            circuitBreaker: this.circuitBreaker.getMetrics(),
            rateLimit: {
                requestsInWindow: this.rateLimiter.timestamps.length,
                maxRequests: this.rateLimiter.maxRequests
            }
        };
    }
}
