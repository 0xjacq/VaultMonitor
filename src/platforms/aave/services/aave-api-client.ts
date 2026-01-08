/**
 * Aave API Client with Circuit Breaker
 * 
 * Wrapper for Aave V3 Data API
 * Monitors user positions, health factors, and liquidation risks
 */

import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface AaveApiClientConfig {
    baseUrl?: string;
    rateLimit?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * Aave API Client for V3 protocol
 */
export class AaveApiClient {
    private baseUrl: string;
    private circuitBreaker: CircuitBreaker;
    private lastRequestTime = 0;
    private minRequestInterval: number;

    constructor(config: AaveApiClientConfig = {}) {
        this.baseUrl = config.baseUrl || 'https://aave-api-v2.aave.com';

        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };
        this.circuitBreaker = new CircuitBreaker(cbConfig, 'AaveAPI');

        // Rate limiting: max 1 request per second
        const rateLimit = config.rateLimit || 60;
        this.minRequestInterval = 60000 / rateLimit;
    }

    /**
     * Get user position data
     * 
     * @param chainId Chain ID (1 = Ethereum, 137 = Polygon, etc.)
     * @param userAddress User wallet address
     */
    async getUserPosition(chainId: number, userAddress: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/data/users/${userAddress}?chainId=${chainId}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                if (response.status === 404) {
                    // User has no position
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get reserve data (market info)
     * 
     * @param chainId Chain ID
     * @param assetAddress Asset address
     */
    async getReserveData(chainId: number, assetAddress: string): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/data/reserves/${assetAddress}?chainId=${chainId}`;
            const response = await this.fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        });
    }

    /**
     * Get all reserves for a chain
     */
    async getAllReserves(chainId: number): Promise<any> {
        await this.rateLimit();

        return this.circuitBreaker.execute(async () => {
            const url = `${this.baseUrl}/data/markets?chainId=${chainId}`;
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
