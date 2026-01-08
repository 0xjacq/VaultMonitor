/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects against cascading failures when external services (APIs, RPCs) fail.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 * 
 * Flow:
 * CLOSED --[failures >= threshold]--> OPEN
 * OPEN --[timeout elapsed]--> HALF_OPEN
 * HALF_OPEN --[successes >= attempts]--> CLOSED
 * HALF_OPEN --[any failure]--> OPEN
 */

export enum CircuitState {
    CLOSED = 'CLOSED',         // Normal operation
    OPEN = 'OPEN',             // Failing - reject all requests
    HALF_OPEN = 'HALF_OPEN'    // Testing recovery
}

export interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening circuit
    resetTimeout: number;          // Time to wait before trying again (ms)
    halfOpenMaxAttempts: number;   // Number of test requests in HALF_OPEN state
}

export interface CircuitBreakerMetrics {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    lastStateChange: number;
}

/**
 * Circuit Breaker - prevents cascading failures
 * 
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 60000,
 *   halfOpenMaxAttempts: 3
 * }, 'MyAPI');
 * 
 * await breaker.execute(async () => {
 *   return fetch('https://api.example.com');
 * });
 * ```
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime = 0;
    private lastStateChange = Date.now();
    private halfOpenAttempts = 0;

    constructor(
        private config: CircuitBreakerConfig,
        private serviceName: string
    ) {
        this.validateConfig();
    }

    /**
     * Execute a function with circuit breaker protection
     * 
     * @param fn Function to execute
     * @returns Result of the function
     * @throws Error if circuit is OPEN or function fails
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if we should transition from OPEN to HALF_OPEN
        if (this.state === CircuitState.OPEN) {
            const timeSinceFailure = Date.now() - this.lastFailureTime;

            if (timeSinceFailure >= this.config.resetTimeout) {
                this.transitionTo(CircuitState.HALF_OPEN);
                this.halfOpenAttempts = 0;
            } else {
                const remainingTime = Math.ceil((this.config.resetTimeout - timeSinceFailure) / 1000);
                throw new Error(
                    `Circuit OPEN for ${this.serviceName}. Retry in ${remainingTime}s`
                );
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    private onSuccess(): void {
        this.successCount++;

        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenAttempts++;

            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                console.log(
                    `[CircuitBreaker:${this.serviceName}] Service recovered after ${this.halfOpenAttempts} successful tests. Closing circuit.`
                );
                this.transitionTo(CircuitState.CLOSED);
                this.failureCount = 0;
                this.successCount = 0;
            }
        } else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success in CLOSED state
            this.failureCount = 0;
        }
    }

    /**
     * Handle failed execution
     */
    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        console.error(
            `[CircuitBreaker:${this.serviceName}] Failure ${this.failureCount}/${this.config.failureThreshold} (State: ${this.state})`
        );

        // If in HALF_OPEN, immediately go back to OPEN on any failure
        if (this.state === CircuitState.HALF_OPEN) {
            console.error(
                `[CircuitBreaker:${this.serviceName}] Test failed in HALF_OPEN state. Reopening circuit.`
            );
            this.transitionTo(CircuitState.OPEN);
            return;
        }

        // If in CLOSED and threshold exceeded, open circuit
        if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
            const timeoutSec = Math.ceil(this.config.resetTimeout / 1000);
            console.error(
                `[CircuitBreaker:${this.serviceName}] Opening circuit. Service unavailable for ${timeoutSec}s`
            );
            this.transitionTo(CircuitState.OPEN);
        }
    }

    /**
     * Transition to a new state
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();

        if (newState !== oldState) {
            console.log(
                `[CircuitBreaker:${this.serviceName}] State transition: ${oldState} -> ${newState}`
            );
        }
    }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get circuit breaker metrics
     */
    getMetrics(): CircuitBreakerMetrics {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastStateChange: this.lastStateChange
        };
    }

    /**
     * Check if circuit is healthy (CLOSED state)
     */
    isHealthy(): boolean {
        return this.state === CircuitState.CLOSED;
    }

    /**
     * Manually reset the circuit breaker to CLOSED state
     * Use with caution - typically only for testing or manual intervention
     */
    reset(): void {
        console.log(`[CircuitBreaker:${this.serviceName}] Manual reset`);
        this.transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
    }

    /**
     * Validate configuration
     */
    private validateConfig(): void {
        if (this.config.failureThreshold < 1) {
            throw new Error('failureThreshold must be >= 1');
        }
        if (this.config.resetTimeout < 0) {
            throw new Error('resetTimeout must be >= 0');
        }
        if (this.config.halfOpenMaxAttempts < 1) {
            throw new Error('halfOpenMaxAttempts must be >= 1');
        }
    }
}
