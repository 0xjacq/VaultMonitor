/**
 * Unit Tests for PtDiscountProbe
 */
import { describe, it, expect, vi } from 'vitest';
import { PtDiscountProbe } from '../../../../../src/platforms/pendle/probes/pt-discount';
import { PendleApiClient } from '../../../../../src/platforms/pendle/services/pendle-api-client';

function makeConfig() {
    return {
        id: 'test-pt-discount',
        platform: 'pendle',
        type: 'pt_discount',
        enabled: true,
        interval: 60000,
        timeout: 15000,
        config: {
            chainId: 1,
            marketAddress: '0xmarket123',
        },
    };
}

function mockApiClient(response: any) {
    return {
        getHistoricalData: vi.fn().mockResolvedValue(response),
    } as unknown as PendleApiClient;
}

// Expiry 30 days from now (unix seconds)
const futureExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

const sampleHistorical = {
    results: [
        { ptDiscount: '0.03', impliedApy: '0.08', expiry: futureExpiry },
        { ptDiscount: '0.05', impliedApy: '0.12', expiry: futureExpiry },
    ],
    expiry: futureExpiry,
};

describe('PtDiscountProbe', () => {
    it('should collect latest data point from historical series', async () => {
        const client = mockApiClient(sampleHistorical);
        const probe = new PtDiscountProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.ptDiscount']).toBe(0.05);
        expect(facts['pendle.fixedApy']).toBe(0.12);
        expect(facts['pendle.daysToExpiry']).toBeGreaterThan(29);
        expect(facts['pendle.daysToExpiry']).toBeLessThanOrEqual(30);
        expect(facts['pendle.marketAddress']).toBe('0xmarket123');
        expect(facts['pendle.chainId']).toBe(1);
        expect(facts['pendle.status']).toBe('success');
    });

    it('should handle array response format', async () => {
        const data = [
            { ptDiscount: '0.02', impliedApy: '0.06', expiry: futureExpiry },
            { ptDiscount: '0.04', impliedApy: '0.10', expiry: futureExpiry },
        ];
        const client = mockApiClient(data);
        const probe = new PtDiscountProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.ptDiscount']).toBe(0.04);
        expect(facts['pendle.fixedApy']).toBe(0.10);
    });

    it('should handle empty results gracefully', async () => {
        const client = mockApiClient({ results: [] });
        const probe = new PtDiscountProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.status']).toBe('success');
        expect(facts['pendle.ptDiscount']).toBeUndefined();
    });

    it('should use expiry from top-level if not in data point', async () => {
        const client = mockApiClient({
            results: [{ ptDiscount: '0.05', impliedApy: '0.12' }],
            expiry: futureExpiry,
        });
        const probe = new PtDiscountProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.daysToExpiry']).toBeGreaterThan(29);
    });

    it('should set error facts on API failure', async () => {
        const client = {
            getHistoricalData: vi.fn().mockRejectedValue(new Error('Not found')),
        } as unknown as PendleApiClient;
        const probe = new PtDiscountProbe('test', makeConfig(), client);

        const facts = await probe.collect({ probe: {}, rule: {} });

        expect(facts['pendle.status']).toBe('error');
        expect(facts['pendle.error']).toBe('Not found');
        expect(facts['pendle.ptDiscount']).toBeNull();
    });
});
