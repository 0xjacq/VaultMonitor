/**
 * Unit Tests for MarketOverviewProbe
 */
import { describe, it, expect, vi } from 'vitest';
import { MarketOverviewProbe } from '../../../../../src/platforms/pendle/probes/market-overview';
import { PendleApiClient } from '../../../../../src/platforms/pendle/services/pendle-api-client';

function makeConfig(overrides: Record<string, any> = {}) {
    return {
        id: 'test-market-overview',
        platform: 'pendle',
        type: 'market_overview',
        enabled: true,
        interval: 300000,
        timeout: 15000,
        config: {
            ...overrides,
        },
    };
}

function mockApiClient(response: any) {
    return {
        getAllMarketsV2: vi.fn().mockResolvedValue(response),
    } as unknown as PendleApiClient;
}

const sampleMarkets = [
    {
        address: '0xmarket1',
        chainId: 1,
        tvl: '5000000',
        aggregatedApy: '0.12',
        pendleApy: '0.03',
        lpPrice: '1.05',
        swapFee: '0.001',
    },
    {
        address: '0xmarket2',
        chainId: 1,
        tvl: '3000000',
        aggregatedApy: '0.08',
        pendleApy: '0.02',
        lpPrice: '1.02',
        swapFee: '0.001',
    },
    {
        address: '0xmarket3',
        chainId: 42161,
        tvl: '2000000',
        aggregatedApy: '0.15',
        pendleApy: '0.05',
        lpPrice: '1.10',
        swapFee: '0.002',
    },
];

describe('MarketOverviewProbe', () => {
    it('should aggregate all markets when no filters', async () => {
        const client = mockApiClient(sampleMarkets);
        const probe = new MarketOverviewProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.tvl']).toBe(10000000);
        expect(facts['pendle.aggregatedApy']).toBeCloseTo((0.12 + 0.08 + 0.15) / 3);
        expect(facts['pendle.pendleApy']).toBeCloseTo((0.03 + 0.02 + 0.05) / 3);
        expect(facts['pendle.marketCount']).toBe(3);
        expect(facts['pendle.status']).toBe('success');
    });

    it('should filter by chainId', async () => {
        const client = mockApiClient(sampleMarkets);
        const probe = new MarketOverviewProbe('test', makeConfig({ chainId: 1 }), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.tvl']).toBe(8000000);
        expect(facts['pendle.marketCount']).toBe(2);
        expect(facts['pendle.aggregatedApy']).toBeCloseTo((0.12 + 0.08) / 2);
    });

    it('should emit single market values when marketAddress specified', async () => {
        const client = mockApiClient(sampleMarkets);
        const probe = new MarketOverviewProbe(
            'test',
            makeConfig({ marketAddress: '0xmarket1' }),
            client
        );

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.tvl']).toBe(5000000);
        expect(facts['pendle.aggregatedApy']).toBe(0.12);
        expect(facts['pendle.pendleApy']).toBe(0.03);
        expect(facts['pendle.lpPrice']).toBe(1.05);
        expect(facts['pendle.swapFee']).toBe(0.001);
        expect(facts['pendle.marketCount']).toBe(1);
    });

    it('should handle nested markets response', async () => {
        const client = mockApiClient({ markets: sampleMarkets });
        const probe = new MarketOverviewProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.tvl']).toBe(10000000);
        expect(facts['pendle.marketCount']).toBe(3);
    });

    it('should handle empty markets', async () => {
        const client = mockApiClient([]);
        const probe = new MarketOverviewProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.tvl']).toBe(0);
        expect(facts['pendle.marketCount']).toBe(0);
        expect(facts['pendle.status']).toBe('success');
    });

    it('should set error facts on API failure', async () => {
        const client = {
            getAllMarketsV2: vi.fn().mockRejectedValue(new Error('Server error')),
        } as unknown as PendleApiClient;
        const probe = new MarketOverviewProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.status']).toBe('error');
        expect(facts['pendle.error']).toBe('Server error');
        expect(facts['pendle.tvl']).toBeNull();
    });
});
