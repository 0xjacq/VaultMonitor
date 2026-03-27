/**
 * Unit Tests for ThresholdRule
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ThresholdRule } from '../../../src/rules/threshold';
import { Severity, ProbeContext, ProbeState } from '../../../src/types/domain';

function makeContext(probeId = 'test-probe', state?: Partial<ProbeState>): ProbeContext {
    return {
        probeId,
        timestamp: Date.now(),
        state: {
            probe: {},
            rule: {},
            ...state
        }
    };
}

describe('ThresholdRule', () => {
    describe('operator >', () => {
        let rule: ThresholdRule;

        beforeEach(() => {
            rule = new ThresholdRule('threshold-1', {
                fact: 'test.value',
                threshold: 100,
                operator: '>',
                severity: Severity.WARNING
            });
        });

        it('should trigger when value > threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 150 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.severity).toBe(Severity.WARNING);
            expect(alert!.probeId).toBe('test-probe');
            expect(alert!.ruleId).toBe('threshold-1');
            expect(alert!.message).toContain('150');
            expect(alert!.message).toContain('100');
        });

        it('should NOT trigger when value <= threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 100 }, ctx);
            expect(alert).toBeNull();
        });

        it('should NOT trigger when value < threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 50 }, ctx);
            expect(alert).toBeNull();
        });
    });

    describe('operator >=', () => {
        let rule: ThresholdRule;

        beforeEach(() => {
            rule = new ThresholdRule('threshold-gte', {
                fact: 'test.value',
                threshold: 100,
                operator: '>=',
            });
        });

        it('should trigger when value == threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 100 }, ctx);
            expect(alert).not.toBeNull();
        });

        it('should trigger when value > threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 200 }, ctx);
            expect(alert).not.toBeNull();
        });

        it('should NOT trigger when value < threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 99 }, ctx);
            expect(alert).toBeNull();
        });
    });

    describe('operator <', () => {
        let rule: ThresholdRule;

        beforeEach(() => {
            rule = new ThresholdRule('threshold-lt', {
                fact: 'test.value',
                threshold: 50,
                operator: '<',
            });
        });

        it('should trigger when value < threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 30 }, ctx);
            expect(alert).not.toBeNull();
        });

        it('should NOT trigger when value >= threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 50 }, ctx);
            expect(alert).toBeNull();
        });
    });

    describe('operator <=', () => {
        let rule: ThresholdRule;

        beforeEach(() => {
            rule = new ThresholdRule('threshold-lte', {
                fact: 'test.value',
                threshold: 50,
                operator: '<=',
            });
        });

        it('should trigger when value == threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 50 }, ctx);
            expect(alert).not.toBeNull();
        });

        it('should trigger when value < threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 10 }, ctx);
            expect(alert).not.toBeNull();
        });

        it('should NOT trigger when value > threshold', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 51 }, ctx);
            expect(alert).toBeNull();
        });
    });

    describe('missing and non-numeric facts', () => {
        let rule: ThresholdRule;

        beforeEach(() => {
            rule = new ThresholdRule('threshold-missing', {
                fact: 'test.value',
                threshold: 100,
                operator: '>',
            });
        });

        it('should return null when fact key is missing', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'other.key': 42 }, ctx);
            expect(alert).toBeNull();
        });

        it('should return null when fact value is not a number', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 'abc' }, ctx);
            expect(alert).toBeNull();
        });

        it('should handle numeric string values', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': '150' }, ctx);
            expect(alert).not.toBeNull();
        });
    });

    describe('alert properties', () => {
        it('should use default severity WARNING when not specified', async () => {
            const rule = new ThresholdRule('threshold-default', {
                fact: 'test.value',
                threshold: 10,
                operator: '>',
            });
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 20 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.severity).toBe(Severity.WARNING);
        });

        it('should use configured severity', async () => {
            const rule = new ThresholdRule('threshold-crit', {
                fact: 'test.value',
                threshold: 10,
                operator: '>',
                severity: Severity.CRITICAL
            });
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 20 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.severity).toBe(Severity.CRITICAL);
        });

        it('should use custom title when provided', async () => {
            const rule = new ThresholdRule('threshold-title', {
                fact: 'test.value',
                threshold: 10,
                operator: '>',
                title: 'Custom Alert Title'
            });
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 20 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.title).toBe('Custom Alert Title');
        });

        it('should use default title when not provided', async () => {
            const rule = new ThresholdRule('threshold-default-title', {
                fact: 'test.value',
                threshold: 10,
                operator: '>',
            });
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 20 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.title).toBe('Threshold Breached');
        });

        it('should include entities with value and threshold', async () => {
            const rule = new ThresholdRule('threshold-entities', {
                fact: 'test.value',
                threshold: 100,
                operator: '>',
            });
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 200 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.entities).toBeDefined();
            expect(alert!.entities!['Value']).toBeDefined();
            expect(alert!.entities!['Threshold']).toBeDefined();
        });
    });

    describe('state-based re-trigger prevention', () => {
        it('should NOT trigger again if already in triggered state', async () => {
            const rule = new ThresholdRule('threshold-state', {
                fact: 'test.value',
                threshold: 100,
                operator: '>',
            });

            const ctx = makeContext();
            // First evaluation triggers
            const alert1 = await rule.evaluate({ 'test.value': 150 }, ctx);
            expect(alert1).not.toBeNull();

            // Second evaluation with same context state should not trigger
            const alert2 = await rule.evaluate({ 'test.value': 200 }, ctx);
            expect(alert2).toBeNull();
        });

        it('should re-trigger after value goes below threshold and back above', async () => {
            const rule = new ThresholdRule('threshold-retrigger', {
                fact: 'test.value',
                threshold: 100,
                operator: '>',
            });

            const ctx = makeContext();
            // First trigger
            const alert1 = await rule.evaluate({ 'test.value': 150 }, ctx);
            expect(alert1).not.toBeNull();

            // Value goes below threshold - resets state to 'ok'
            const alert2 = await rule.evaluate({ 'test.value': 50 }, ctx);
            expect(alert2).toBeNull();

            // Value goes above again - should trigger
            const alert3 = await rule.evaluate({ 'test.value': 200 }, ctx);
            expect(alert3).not.toBeNull();
        });
    });
});
