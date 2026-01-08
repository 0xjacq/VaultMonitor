/**
 * HTTP Client with Circuit Breaker
 * 
 * Shared service for all HTTP-based probes.
 */

import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface HttpClientConfig {
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
    timeout?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

export interface HttpRequestOptions {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
}

/**
 * HTTP Client with Circuit Breaker and retry logic
 */
export class HttpClient {
    private circuitBreaker: CircuitBreaker;
    private defaultTimeout: number;
    private defaultHeaders: Record<string, string>;

    constructor(private config: HttpClientConfig, serviceName: string = 'HTTP') {
        this.defaultTimeout = config.timeout || 10000;
        this.defaultHeaders = config.defaultHeaders || {};

        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenMaxAttempts: 3
        };

        this.circuitBreaker = new CircuitBreaker(cbConfig, serviceName);
    }

    /**
     * Make an HTTP request with circuit breaker protection
     */
    async request<T = any>(options: HttpRequestOptions): Promise<T> {
        return this.circuitBreaker.execute(async () => {
            const url = this.config.baseUrl
                ? `${this.config.baseUrl}${options.url}`
                : options.url;

            const controller = new AbortController();
            const timeout = options.timeout || this.defaultTimeout;
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const headers = {
                    ...this.defaultHeaders,
                    ...options.headers
                };

                // Add Content-Type for POST/PUT
                if (options.body && !headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }

                const response = await fetch(url, {
                    method: options.method || 'GET',
                    headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                return await response.json();
            } catch (err) {
                if (err instanceof Error) {
                    if (err.name === 'AbortError') {
                        throw new Error(`Request timeout after ${timeout}ms`);
                    }
                }
                throw err;
            } finally {
                clearTimeout(timeoutId);
            }
        });
    }

    /**
     * GET request
     */
    async get<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>({ url, method: 'GET', headers });
    }

    /**
     * POST request
     */
    async post<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
        return this.request<T>({ url, method: 'POST', body, headers });
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
        return this.circuitBreaker.getMetrics();
    }
}
