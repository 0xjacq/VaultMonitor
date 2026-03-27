/**
 * Unit Tests for ChangeRule
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeRule } from '../../../src/rules/change';
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

describe('ChangeRule', () => {
    let rule: ChangeRule;

    beforeEach(() => {
        rule = new ChangeRule('change-1', {
            fact: 'test.value',
            severity: Severity.INFO
        });
    });

    describe('first run behavior', () => {
        it('should return null on first run (no previous value)', async () => {
            const ctx = makeContext();
            const alert = await rule.evaluate({ 'test.value': 100 }, ctx);
            expect(alert).toBeNull();
        });

        it('should store current value in state on first run', async () => {
            const ctx = makeContext();
            await rule.evaluate({ 'test.value': 100 }, ctx);
            expect(ctx.state.rule['change-1']).toBe(100);
        });
    });

    describe('change detection', () => {
        it('should trigger when value changes', async () => {
            const ctx = makeContext();

            // First run - stores value
            await rule.evaluate({ 'test.value': 100 }, ctx);

            // Second run - value changed
            const alert = await rule.evaluate({ 'test.value': 200 }, ctx);
            expect(alert).not.toBeNull();
            expect(alert!.probeId).toBe('test-probe');
            expect(alert!.ruleId).toBe('change-1');
            expect(alert!.severity).toBe(Severity.INFO);
        });

        it('should NOT trigger when value stays the same', async () => {
            const ctx = makeContext();

            // First run
            await rule.evaluate({ 'test.value': 100 }, ctx);

            // Second run - same value
            const alert = await rule.evaluate({ 'test.value': 100 }, ctx);
            expect(alert).toBeNull();
        });

        it('should update stored value after change', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 100 }, ctx);
            await rule.evaluate({ 'test.value': 200 }, ctx);

            // State should now have the new value
            expect(ctx.state.rule['change-1']).toBe(200);
        });

        it('should detect string value changes', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 'active' }, ctx);
            const alert = await rule.evaluate({ 'test.value': 'inactive' }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.message).toContain('active');
            expect(alert!.message).toContain('inactive');
        });

        it('should detect boolean value changes', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': true }, ctx);
            const alert = await rule.evaluate({ 'test.value': false }, ctx);

            expect(alert).not.toBeNull();
        });
    });

    describe('alert properties', () => {
        it('should use default severity INFO when not specified', async () => {
            const ruleNoSev = new ChangeRule('change-nosev', {
                fact: 'test.value'
            });
            const ctx = makeContext();

            await ruleNoSev.evaluate({ 'test.value': 1 }, ctx);
            const alert = await ruleNoSev.evaluate({ 'test.value': 2 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.severity).toBe(Severity.INFO);
        });

        it('should use custom title when provided', async () => {
            const ruleTitle = new ChangeRule('change-title', {
                fact: 'test.value',
                title: 'Custom Change Title'
            });
            const ctx = makeContext();

            await ruleTitle.evaluate({ 'test.value': 1 }, ctx);
            const alert = await ruleTitle.evaluate({ 'test.value': 2 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.title).toBe('Custom Change Title');
        });

        it('should use default title when not provided', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 1 }, ctx);
            const alert = await rule.evaluate({ 'test.value': 2 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.title).toBe('Value Changed');
        });

        it('should include default message with old and new values', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 100 }, ctx);
            const alert = await rule.evaluate({ 'test.value': 200 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.message).toContain('100');
            expect(alert!.message).toContain('200');
            expect(alert!.message).toContain('test.value');
        });

        it('should include entities with previous and new values', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 100 }, ctx);
            const alert = await rule.evaluate({ 'test.value': 200 }, ctx);

            expect(alert).not.toBeNull();
            expect(alert!.entities).toBeDefined();
            expect(alert!.entities!['Previous Value']).toBe('100');
            expect(alert!.entities!['New Value']).toBe('200');
        });
    });

    describe('edge cases', () => {
        it('should handle zero values correctly', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': 0 }, ctx);
            const alert = await rule.evaluate({ 'test.value': 100 }, ctx);

            // 0 is not undefined, so previous value exists and change should trigger
            expect(alert).not.toBeNull();
        });

        it('should handle null fact value on first run', async () => {
            const ctx = makeContext();

            // null as first value
            const alert = await rule.evaluate({ 'test.value': null }, ctx);
            expect(alert).toBeNull();
        });

        it('should detect change from null to a value', async () => {
            const ctx = makeContext();

            await rule.evaluate({ 'test.value': null }, ctx);
            const alert = await rule.evaluate({ 'test.value': 42 }, ctx);

            expect(alert).not.toBeNull();
        });

        it('should handle missing fact key gracefully', async () => {
            const ctx = makeContext();

            // First run with undefined (key missing)
            const alert1 = await rule.evaluate({ 'other.key': 100 }, ctx);
            expect(alert1).toBeNull();
        });
    });
});
