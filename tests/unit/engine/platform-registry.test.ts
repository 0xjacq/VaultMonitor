/**
 * Unit Tests for PlatformRegistry
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformRegistry } from '../../../src/engine/platform-registry';
import { BasePlatform, PlatformMetadata, PlatformConfig } from '../../../src/platforms/base-platform';
import { BaseProbe } from '../../../src/core/base-probe';

// Mock platform for testing
class MockPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'mock',
        name: 'Mock Platform',
        version: '1.0.0',
        supportedProbeTypes: ['test_probe']
    };

    async initialize(config: PlatformConfig): Promise<void> {
        // Mock initialization
    }

    createProbe(type: string, config: any): BaseProbe {
        // Return mock probe
        return {} as BaseProbe;
    }

    async destroy(): Promise<void> {
        // Mock cleanup
    }
}

class AnotherMockPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'another',
        name: 'Another Platform',
        version: '2.0.0',
        supportedProbeTypes: ['other_probe']
    };

    async initialize(config: PlatformConfig): Promise<void> { }
    createProbe(type: string, config: any): BaseProbe {
        return {} as BaseProbe;
    }
    async destroy(): Promise<void> { }
}

describe('PlatformRegistry', () => {
    let registry: PlatformRegistry;

    beforeEach(() => {
        registry = new PlatformRegistry();
    });

    describe('registration', () => {
        it('should register a platform', () => {
            const platform = new MockPlatform();
            registry.register(platform);

            expect(registry.has('mock')).toBe(true);
            expect(registry.get('mock')).toBe(platform);
        });

        it('should throw on duplicate platform ID', () => {
            const platform1 = new MockPlatform();
            const platform2 = new MockPlatform();

            registry.register(platform1);

            expect(() => {
                registry.register(platform2);
            }).toThrow('Platform mock is already registered');
        });

        it('should register multiple platforms', () => {
            const mock = new MockPlatform();
            const another = new AnotherMockPlatform();

            registry.register(mock);
            registry.register(another);

            expect(registry.getPlatformIds()).toEqual(['mock', 'another']);
            expect(registry.getAll()).toHaveLength(2);
        });
    });

    describe('platform access', () => {
        beforeEach(() => {
            registry.register(new MockPlatform());
        });

        it('should get platform by ID', () => {
            const platform = registry.get('mock');
            expect(platform).toBeDefined();
            expect(platform?.metadata.id).toBe('mock');
        });

        it('should return undefined for non-existent platform', () => {
            expect(registry.get('nonexistent')).toBeUndefined();
        });

        it('should check platform existence', () => {
            expect(registry.has('mock')).toBe(true);
            expect(registry.has('nonexistent')).toBe(false);
        });

        it('should get all platforms', () => {
            registry.register(new AnotherMockPlatform());

            const platforms = registry.getAll();
            expect(platforms).toHaveLength(2);
            expect(platforms.map(p => p.metadata.id)).toEqual(['mock', 'another']);
        });
    });

    describe('platform initialization', () => {
        it('should initialize all platforms with config', async () => {
            const mock = new MockPlatform();
            const initSpy = vi.spyOn(mock, 'initialize');

            registry.register(mock);

            const configs = new Map([
                ['mock', { enabled: true, someOption: 'value' }]
            ]);

            await registry.initializeAll(configs);

            expect(initSpy).toHaveBeenCalledWith({
                enabled: true,
                someOption: 'value'
            });
        });

        it('should skip disabled platforms', async () => {
            const mock = new MockPlatform();
            const initSpy = vi.spyOn(mock, 'initialize');

            registry.register(mock);

            const configs = new Map([
                ['mock', { enabled: false }]
            ]);

            await registry.initializeAll(configs);

            expect(initSpy).not.toHaveBeenCalled();
        });

        it('should use default enabled:true if no config provided', async () => {
            const mock = new MockPlatform();
            const initSpy = vi.spyOn(mock, 'initialize');

            registry.register(mock);

            await registry.initializeAll(new Map());

            expect(initSpy).toHaveBeenCalledWith({ enabled: true });
        });

        it('should throw if platform initialization fails', async () => {
            const mock = new MockPlatform();
            vi.spyOn(mock, 'initialize').mockRejectedValueOnce(new Error('Init failed'));

            registry.register(mock);

            await expect(
                registry.initializeAll(new Map())
            ).rejects.toThrow('Platform mock initialization failed');
        });
    });

    describe('platform destruction', () => {
        it('should destroy all platforms', async () => {
            const mock = new MockPlatform();
            const another = new AnotherMockPlatform();
            const destroySpy1 = vi.spyOn(mock, 'destroy');
            const destroySpy2 = vi.spyOn(another, 'destroy');

            registry.register(mock);
            registry.register(another);

            await registry.initializeAll(new Map());
            await registry.destroyAll();

            expect(destroySpy1).toHaveBeenCalled();
            expect(destroySpy2).toHaveBeenCalled();
            expect(registry.getAll()).toHaveLength(0);
        });

        it('should handle destroy errors gracefully', async () => {
            const mock = new MockPlatform();
            vi.spyOn(mock, 'destroy').mockRejectedValueOnce(new Error('Destroy failed'));

            registry.register(mock);
            await registry.initializeAll(new Map());

            // Should not throw
            await expect(registry.destroyAll()).resolves.toBeUndefined();
        });
    });

    describe('health status', () => {
        it('should get health status of all platforms', async () => {
            const mock = new MockPlatform();
            const another = new AnotherMockPlatform();

            vi.spyOn(mock, 'healthCheck').mockResolvedValue(true);
            vi.spyOn(another, 'healthCheck').mockResolvedValue(false);

            registry.register(mock);
            registry.register(another);

            const health = await registry.getHealthStatus();

            expect(health.get('mock')).toBe(true);
            expect(health.get('another')).toBe(false);
        });
    });

    describe('summary', () => {
        it('should provide registry summary', () => {
            registry.register(new MockPlatform());
            registry.register(new AnotherMockPlatform());

            const summary = registry.getSummary();

            expect(summary.totalPlatforms).toBe(2);
            expect(summary.platforms).toHaveLength(2);
            expect(summary.platforms[0]).toEqual({
                id: 'mock',
                name: 'Mock Platform',
                version: '1.0.0',
                probeTypes: ['test_probe']
            });
        });
    });
});
