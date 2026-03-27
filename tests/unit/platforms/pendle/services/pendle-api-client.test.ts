/**
 * Unit Tests for PendleApiClient (new methods)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PendleApiClient } from '../../../../../src/platforms/pendle/services/pendle-api-client';

describe('PendleApiClient', () => {
    let client: PendleApiClient;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        client = new PendleApiClient({ rateLimit: 1000 }); // High limit for tests
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    function mockFetch(body: any, status = 200) {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: status >= 200 && status < 300,
            status,
            statusText: status === 200 ? 'OK' : 'Error',
            json: () => Promise.resolve(body),
        });
    }

    describe('getUserDashboard', () => {
        it('should fetch user dashboard', async () => {
            const data = [{ valueUsd: '1000' }];
            mockFetch(data);

            const result = await client.getUserDashboard('0xuser123');

            expect(result).toEqual(data);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/dashboard/user/0xuser123'),
                expect.any(Object)
            );
        });

        it('should throw on 404', async () => {
            mockFetch({}, 404);

            await expect(client.getUserDashboard('0xbad')).rejects.toThrow('User not found');
        });

        it('should throw on 429', async () => {
            mockFetch({}, 429);

            await expect(client.getUserDashboard('0xuser')).rejects.toThrow('Rate limited');
        });

        it('should throw on 500', async () => {
            mockFetch({}, 500);

            await expect(client.getUserDashboard('0xuser')).rejects.toThrow('server error');
        });
    });

    describe('getHistoricalData', () => {
        it('should fetch historical data with default timeFrame', async () => {
            const data = { results: [{ ptDiscount: '0.05' }] };
            mockFetch(data);

            const result = await client.getHistoricalData(1, '0xmarket');

            expect(result).toEqual(data);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/1/markets/0xmarket/historicalDataV2?timeFrame=week'),
                expect.any(Object)
            );
        });

        it('should pass custom timeFrame', async () => {
            mockFetch({ results: [] });

            await client.getHistoricalData(42161, '0xmarket', 'month');

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('timeFrame=month'),
                expect.any(Object)
            );
        });

        it('should throw on 404', async () => {
            mockFetch({}, 404);

            await expect(client.getHistoricalData(1, '0xbad')).rejects.toThrow('Market not found');
        });
    });

    describe('getAllMarketsV2', () => {
        it('should fetch all markets', async () => {
            const data = [{ address: '0xmarket1', tvl: '5000000' }];
            mockFetch(data);

            const result = await client.getAllMarketsV2();

            expect(result).toEqual(data);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/v2/markets/getAllMarketsV2'),
                expect.any(Object)
            );
        });

        it('should throw on 429', async () => {
            mockFetch({}, 429);

            await expect(client.getAllMarketsV2()).rejects.toThrow('Rate limited');
        });

        it('should throw on 500', async () => {
            mockFetch({}, 500);

            await expect(client.getAllMarketsV2()).rejects.toThrow('server error');
        });
    });
});
