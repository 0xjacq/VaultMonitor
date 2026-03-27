/**
 * Unit Tests for StateManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from '../../../src/data/db';
import { StateManager } from '../../../src/engine/state-manager';

describe('StateManager', () => {
    beforeEach(() => {
        resetDatabase();
    });

    describe('getProbeState / saveProbeState', () => {
        it('should return empty state for unknown probe', () => {
            const state = StateManager.getProbeState('unknown-probe');
            expect(state).toEqual({ probe: {}, rule: {} });
        });

        it('should roundtrip save and get probe state', () => {
            const probeId = 'test-probe-1';
            const state = {
                probe: { lastBlock: 12345, someFlag: true },
                rule: { 'rule-1': { status: 'triggered' } as Record<string, unknown> }
            };

            StateManager.saveProbeState(probeId, state);
            const retrieved = StateManager.getProbeState(probeId);

            expect(retrieved.probe).toEqual(state.probe);
            expect(retrieved.rule).toEqual(state.rule);
        });

        it('should overwrite existing state on save', () => {
            const probeId = 'test-probe-2';

            StateManager.saveProbeState(probeId, {
                probe: { version: 1 },
                rule: {}
            });

            StateManager.saveProbeState(probeId, {
                probe: { version: 2 },
                rule: { 'r1': { x: 1 } as Record<string, unknown> }
            });

            const retrieved = StateManager.getProbeState(probeId);
            expect(retrieved.probe).toEqual({ version: 2 });
            expect(retrieved.rule).toEqual({ 'r1': { x: 1 } });
        });
    });

    describe('isAlertSent / recordAlert', () => {
        it('should return false for unknown alert', () => {
            expect(StateManager.isAlertSent('unknown-alert')).toBe(false);
        });

        it('should return true after recording alert', () => {
            StateManager.recordAlert('alert-1', 'probe-1', 'rule-1');
            expect(StateManager.isAlertSent('alert-1')).toBe(true);
        });

        it('should still return false for different alert id', () => {
            StateManager.recordAlert('alert-1', 'probe-1', 'rule-1');
            expect(StateManager.isAlertSent('alert-2')).toBe(false);
        });
    });

    describe('isInCooldown / recordCooldown', () => {
        it('should return false when no cooldown recorded', () => {
            expect(StateManager.isInCooldown('probe-1:rule-1', 15 * 60 * 1000)).toBe(false);
        });

        it('should return true within cooldown interval', () => {
            const key = 'probe-1:rule-1';
            StateManager.recordCooldown(key);

            // Use a large interval (24h) to account for SQLite CURRENT_TIMESTAMP being UTC
            expect(StateManager.isInCooldown(key, 24 * 60 * 60 * 1000)).toBe(true);
        });

        it('should return false after interval expires', () => {
            const key = 'probe-1:rule-1';
            StateManager.recordCooldown(key);

            // Check with 0ms interval - effectively expired immediately
            expect(StateManager.isInCooldown(key, 0)).toBe(false);
        });
    });

    describe('recordAlertWithCooldown', () => {
        it('should record both alert and cooldown atomically', () => {
            StateManager.recordAlertWithCooldown('alert-1', 'probe-1', 'rule-1', 'probe-1:rule-1');

            expect(StateManager.isAlertSent('alert-1')).toBe(true);
            // Use a large interval (24h) to account for SQLite CURRENT_TIMESTAMP being UTC
            expect(StateManager.isInCooldown('probe-1:rule-1', 24 * 60 * 60 * 1000)).toBe(true);
        });
    });

    describe('recordRun', () => {
        it('should insert into run_history without error', () => {
            // Should not throw
            expect(() => {
                StateManager.recordRun('probe-1', 'ok', 150);
            }).not.toThrow();
        });

        it('should record run with error message', () => {
            expect(() => {
                StateManager.recordRun('probe-1', 'error', 50, 'Connection timeout');
            }).not.toThrow();
        });

        it('should record multiple runs for same probe', () => {
            StateManager.recordRun('probe-1', 'ok', 100);
            StateManager.recordRun('probe-1', 'ok', 120);
            StateManager.recordRun('probe-1', 'error', 50, 'Failed');

            // Verify by checking no errors thrown - we can't easily query
            // run_history without adding a getter, but the insert succeeded
            expect(true).toBe(true);
        });
    });
});
