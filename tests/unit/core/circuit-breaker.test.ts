/**
 * Unit Tests for Circuit Breaker
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../../src/core/circuit-breaker';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 1000,
            halfOpenMaxAttempts: 2
        }, 'TestService');
    });

    describe('initialization', () => {
        it('should start in CLOSED state', () => {
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
            expect(breaker.isHealthy()).toBe(true);
        });

        it('should throw on invalid config', () => {
            expect(() => {
                new CircuitBreaker({
                    failureThreshold: 0,
                    resetTimeout: 1000,
                    halfOpenMaxAttempts: 2
                }, 'Test');
            }).toThrow('failureThreshold must be >= 1');
        });
    });

    describe('CLOSED to OPEN transition', () => {
        it('should open circuit after threshold failures', async () => {
            const failingFn = vi.fn().mockRejectedValue(new Error('Service error'));

            // First 2 failures should keep circuit CLOSED
            await expect(breaker.execute(failingFn)).rejects.toThrow();
            expect(breaker.getState()).toBe(CircuitState.CLOSED);

            await expect(breaker.execute(failingFn)).rejects.toThrow();
            expect(breaker.getState()).toBe(CircuitState.CLOSED);

            // 3rd failure should OPEN circuit
            await expect(breaker.execute(failingFn)).rejects.toThrow();
            expect(breaker.getState()).toBe(CircuitState.OPEN);
            expect(breaker.isHealthy()).toBe(false);
        });

        it('should reset failure count on success', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce('success')  // Success resets count
                .mockRejectedValueOnce(new Error('fail'));

            await expect(breaker.execute(fn)).rejects.toThrow();
            await expect(breaker.execute(fn)).rejects.toThrow();
            await expect(breaker.execute(fn)).resolves.toBe('success');

            // Circuit should still be CLOSED (count was reset)
            await expect(breaker.execute(fn)).rejects.toThrow();
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
        });
    });

    describe('OPEN state behavior', () => {
        beforeEach(async () => {
            const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(failingFn)).rejects.toThrow();
            }
        });

        it('should reject immediately without calling function', async () => {
            const fn = vi.fn();

            await expect(breaker.execute(fn)).rejects.toThrow('Circuit OPEN');
            expect(fn).not.toHaveBeenCalled();
        });

        it('should transition to HALF_OPEN after timeout', async () => {
            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            const successFn = vi.fn().mockResolvedValue('success');
            await breaker.execute(successFn);

            expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
        }, 10000);
    });

    describe('HALF_OPEN state behavior', () => {
        beforeEach(async () => {
            const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
            // Open circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(failingFn)).rejects.toThrow();
            }
            // Wait for transition to HALF_OPEN
            await new Promise(resolve => setTimeout(resolve, 1100));
        });

        it('should close circuit after successful tests', async () => {
            const successFn = vi.fn().mockResolvedValue('success');

            // First successful test
            await breaker.execute(successFn);
            expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

            // Second successful test should CLOSE circuit
            await breaker.execute(successFn);
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
            expect(breaker.isHealthy()).toBe(true);
        }, 10000);

        it('should reopen on any failure in HALF_OPEN', async () => {
            const successFn = vi.fn().mockResolvedValue('success');
            const failFn = vi.fn().mockRejectedValue(new Error('fail'));

            // First test succeeds
            await breaker.execute(successFn);
            expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

            // Second test fails - should reopen
            await expect(breaker.execute(failFn)).rejects.toThrow();
            expect(breaker.getState()).toBe(CircuitState.OPEN);
        }, 10000);
    });

    describe('metrics', () => {
        it('should track failures and successes', async () => {
            const successFn = vi.fn().mockResolvedValue('ok');
            const failFn = vi.fn().mockRejectedValue(new Error('error'));

            await breaker.execute(successFn);
            await expect(breaker.execute(failFn)).rejects.toThrow();
            await breaker.execute(successFn);

            const metrics = breaker.getMetrics();
            expect(metrics.successCount).toBe(2);
            expect(metrics.failureCount).toBe(0);  // Reset after success
            expect(metrics.state).toBe(CircuitState.CLOSED);
        });
    });

    describe('manual reset', () => {
        it('should allow manual reset to CLOSED', async () => {
            const failFn = vi.fn().mockRejectedValue(new Error('fail'));

            // Open circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(failFn)).rejects.toThrow();
            }
            expect(breaker.getState()).toBe(CircuitState.OPEN);

            // Manual reset
            breaker.reset();
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
            expect(breaker.isHealthy()).toBe(true);
        });
    });
});
