/**
 * Unit Tests for AlertManager
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertManager, NotificationChannel } from '../../../src/engine/alert-manager';
import { Alert, Severity, ProbeState } from '../../../src/types/domain';

function makeAlert(overrides: Partial<Alert> = {}): Alert {
    return {
        id: 'alert-1',
        probeId: 'probe-1',
        ruleId: 'rule-1',
        severity: Severity.WARNING,
        title: 'Test Alert',
        message: 'Test alert message',
        timestamp: Date.now(),
        ...overrides
    };
}

function makeChannel(name: string = 'test-channel'): NotificationChannel & { send: ReturnType<typeof vi.fn> } {
    return {
        name,
        send: vi.fn().mockResolvedValue(undefined)
    };
}

function makeMockStateManager() {
    return {
        isAlertSent: vi.fn().mockReturnValue(false),
        isInCooldown: vi.fn().mockReturnValue(false),
        recordAlertWithCooldown: vi.fn(),
        recordAlert: vi.fn(),
        recordCooldown: vi.fn(),
        getProbeState: vi.fn().mockReturnValue({ probe: {}, rule: {} }),
        saveProbeState: vi.fn(),
        recordRun: vi.fn()
    };
}

describe('AlertManager', () => {
    let alertManager: AlertManager;
    let mockStateManager: ReturnType<typeof makeMockStateManager>;
    let channel: ReturnType<typeof makeChannel>;

    beforeEach(() => {
        mockStateManager = makeMockStateManager();
        alertManager = new AlertManager(mockStateManager as any);
        channel = makeChannel();
        alertManager.registerChannel(channel);
    });

    describe('mute check', () => {
        it('should suppress alert when probe is muted (muted_until in future)', async () => {
            const alert = makeAlert();
            const state: ProbeState = {
                probe: { muted_until: Date.now() + 60000 },
                rule: {}
            };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).not.toHaveBeenCalled();
        });

        it('should NOT suppress alert when mute has expired', async () => {
            const alert = makeAlert();
            const state: ProbeState = {
                probe: { muted_until: Date.now() - 1000 },
                rule: {}
            };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).toHaveBeenCalledWith(alert);
        });

        it('should NOT suppress alert when no mute is set', async () => {
            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).toHaveBeenCalledWith(alert);
        });
    });

    describe('dedup check', () => {
        it('should suppress alert when duplicate (isAlertSent returns true)', async () => {
            mockStateManager.isAlertSent.mockReturnValue(true);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).not.toHaveBeenCalled();
        });

        it('should pass alert through when not a duplicate', async () => {
            mockStateManager.isAlertSent.mockReturnValue(false);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).toHaveBeenCalledWith(alert);
        });
    });

    describe('cooldown check', () => {
        it('should suppress alert when in cooldown', async () => {
            mockStateManager.isInCooldown.mockReturnValue(true);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).not.toHaveBeenCalled();
        });

        it('should pass alert through when not in cooldown', async () => {
            mockStateManager.isInCooldown.mockReturnValue(false);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).toHaveBeenCalledWith(alert);
        });
    });

    describe('channel routing', () => {
        it('should route alert to all registered channels', async () => {
            const channel2 = makeChannel('channel-2');
            alertManager.registerChannel(channel2);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(channel.send).toHaveBeenCalledWith(alert);
            expect(channel2.send).toHaveBeenCalledWith(alert);
        });

        it('should handle channel failure without preventing other channels', async () => {
            const failingChannel = makeChannel('failing-channel');
            failingChannel.send.mockRejectedValue(new Error('Channel error'));
            const channel2 = makeChannel('channel-2');

            // Re-create with both channels
            alertManager = new AlertManager(mockStateManager as any);
            alertManager.registerChannel(failingChannel);
            alertManager.registerChannel(channel2);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            // Should not throw
            await alertManager.processAlerts([alert], state);

            // Both channels should have been called
            expect(failingChannel.send).toHaveBeenCalledWith(alert);
            expect(channel2.send).toHaveBeenCalledWith(alert);
        });
    });

    describe('recording', () => {
        it('should record alert after successful routing', async () => {
            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(mockStateManager.recordAlertWithCooldown).toHaveBeenCalledWith(
                alert.id,
                alert.probeId,
                alert.ruleId,
                `${alert.probeId}:${alert.ruleId}`
            );
        });

        it('should NOT record alert when suppressed', async () => {
            mockStateManager.isAlertSent.mockReturnValue(true);

            const alert = makeAlert();
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert], state);
            expect(mockStateManager.recordAlertWithCooldown).not.toHaveBeenCalled();
        });
    });

    describe('multiple alerts', () => {
        it('should process multiple alerts in sequence', async () => {
            const alert1 = makeAlert({ id: 'alert-1', probeId: 'probe-1', ruleId: 'rule-1' });
            const alert2 = makeAlert({ id: 'alert-2', probeId: 'probe-2', ruleId: 'rule-2' });
            const state: ProbeState = { probe: {}, rule: {} };

            await alertManager.processAlerts([alert1, alert2], state);

            expect(channel.send).toHaveBeenCalledTimes(2);
            expect(channel.send).toHaveBeenCalledWith(alert1);
            expect(channel.send).toHaveBeenCalledWith(alert2);
        });
    });
});
