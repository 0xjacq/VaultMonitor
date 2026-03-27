/**
 * Unit Tests for UserPositionProbe
 */
import { describe, it, expect, vi } from 'vitest';
import { UserPositionProbe } from '../../../../../src/platforms/pendle/probes/user-position';
import { PendleApiClient } from '../../../../../src/platforms/pendle/services/pendle-api-client';

function makeConfig(overrides: Record<string, any> = {}) {
    return {
        id: 'test-user-position',
        platform: 'pendle',
        type: 'user_position',
        enabled: true,
        interval: 300000,
        timeout: 15000,
        config: {
            walletAddress: '0xabcdef1234567890',
            ...overrides,
        },
    };
}

function mockApiClient(response: any) {
    return {
        getUserDashboard: vi.fn().mockResolvedValue(response),
    } as unknown as PendleApiClient;
}

const samplePositions = [
    {
        chainId: 1,
        valueUsd: '5000',
        ptValueUsd: '2000',
        ytValueUsd: '1000',
        lpValueUsd: '2000',
        claimableRewardsUsd: '50',
    },
    {
        chainId: 42161,
        valueUsd: '3000',
        ptValueUsd: '1500',
        ytValueUsd: '500',
        lpValueUsd: '1000',
        claimableRewardsUsd: '25',
    },
];

describe('UserPositionProbe', () => {
    it('should collect position facts from dashboard', async () => {
        const client = mockApiClient(samplePositions);
        const probe = new UserPositionProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.totalValueUsd']).toBe(8000);
        expect(facts['pendle.ptHoldings']).toBe(3500);
        expect(facts['pendle.ytHoldings']).toBe(1500);
        expect(facts['pendle.lpHoldings']).toBe(3000);
        expect(facts['pendle.claimableRewards']).toBe(75);
        expect(facts['pendle.positionCount']).toBe(2);
        expect(facts['pendle.walletAddress']).toBe('0xabcdef1234567890');
        expect(facts['pendle.status']).toBe('success');
    });

    it('should filter positions by chainId when specified', async () => {
        const client = mockApiClient(samplePositions);
        const probe = new UserPositionProbe('test', makeConfig({ chainId: 1 }), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.totalValueUsd']).toBe(5000);
        expect(facts['pendle.positionCount']).toBe(1);
    });

    it('should handle empty positions', async () => {
        const client = mockApiClient([]);
        const probe = new UserPositionProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.totalValueUsd']).toBe(0);
        expect(facts['pendle.positionCount']).toBe(0);
        expect(facts['pendle.status']).toBe('success');
    });

    it('should handle nested positions response', async () => {
        const client = mockApiClient({ positions: samplePositions });
        const probe = new UserPositionProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.totalValueUsd']).toBe(8000);
        expect(facts['pendle.positionCount']).toBe(2);
    });

    it('should set error facts on API failure', async () => {
        const client = {
            getUserDashboard: vi.fn().mockRejectedValue(new Error('API timeout')),
        } as unknown as PendleApiClient;
        const probe = new UserPositionProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.status']).toBe('error');
        expect(facts['pendle.error']).toBe('API timeout');
        expect(facts['pendle.totalValueUsd']).toBeNull();
    });
});
