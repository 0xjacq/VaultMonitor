/**
 * Platform Registry
 * 
 * Central registry for all platform adapters.
 * Manages platform lifecycle (registration, initialization, destruction).
 */

import { BasePlatform, PlatformConfig } from '../platforms/base-platform';

/**
 * Platform Registry - manages all registered platforms
 * 
 * Usage:
 * ```typescript
 * const registry = new PlatformRegistry();
 * 
 * // Register platforms
 * registry.register(new PendlePlatform());
 * registry.register(new AavePlatform());
 * 
 * // Initialize with config
 * await registry.initializeAll(platformConfigs);
 * 
 * // Get platform when creating probes
 * const platform = registry.get('pendle');
 * ```
 */
export class PlatformRegistry {
    private platforms = new Map<string, BasePlatform>();
    private initialized = false;

    /**
     * Register a platform
     * 
     * @param platform Platform instance to register
     * @throws Error if platform ID is already registered
     */
    register(platform: BasePlatform): void {
        const id = platform.metadata.id;

        if (this.platforms.has(id)) {
            throw new Error(
                `Platform ${id} is already registered. ` +
                `Each platform must have a unique ID.`
            );
        }

        this.platforms.set(id, platform);
        console.log(
            `[PlatformRegistry] Registered platform: ${platform.metadata.name} (${id}) ` +
            `v${platform.metadata.version}`
        );
        console.log(
            `[PlatformRegistry]   Supported probe types: ${platform.metadata.supportedProbeTypes.join(', ')}`
        );
    }

    /**
     * Get a registered platform by ID
     * 
     * @param platformId Platform ID
     * @returns Platform instance or undefined if not found
     */
    get(platformId: string): BasePlatform | undefined {
        return this.platforms.get(platformId);
    }

    /**
     * Check if a platform is registered
     * 
     * @param platformId Platform ID
     * @returns true if platform is registered
     */
    has(platformId: string): boolean {
        return this.platforms.has(platformId);
    }

    /**
     * Get all registered platforms
     * 
     * @returns Array of all registered platforms
     */
    getAll(): BasePlatform[] {
        return Array.from(this.platforms.values());
    }

    /**
     * Get all registered platform IDs
     * 
     * @returns Array of platform IDs
     */
    getPlatformIds(): string[] {
        return Array.from(this.platforms.keys());
    }

    /**
     * Initialize all platforms with their configurations
     * 
     * @param platformConfigs Map of platform ID to config
     */
    async initializeAll(platformConfigs: Map<string, PlatformConfig>): Promise<void> {
        if (this.initialized) {
            console.warn('[PlatformRegistry] Platforms already initialized');
            return;
        }

        console.log(`[PlatformRegistry] Initializing ${this.platforms.size} platforms...`);

        const initPromises: Promise<void>[] = [];

        for (const [id, platform] of this.platforms) {
            // Get config for this platform (default to enabled if not specified)
            const config = platformConfigs.get(id) || { enabled: true };

            // Skip disabled platforms
            if (config.enabled === false) {
                console.log(`[PlatformRegistry] Skipping disabled platform: ${id}`);
                continue;
            }

            // Initialize platform
            const initPromise = platform.initialize(config)
                .then(() => {
                    console.log(`[PlatformRegistry] ✓ Initialized platform: ${id}`);
                })
                .catch((err) => {
                    console.error(`[PlatformRegistry] ✗ Failed to initialize platform ${id}:`, err);
                    throw new Error(`Platform ${id} initialization failed: ${err.message}`);
                });

            initPromises.push(initPromise);
        }

        // Wait for all platforms to initialize
        await Promise.all(initPromises);

        this.initialized = true;
        console.log('[PlatformRegistry] All platforms initialized successfully');
    }

    /**
     * Destroy all platforms (cleanup)
     * 
     * Called during application shutdown
     */
    async destroyAll(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        console.log('[PlatformRegistry] Destroying all platforms...');

        const destroyPromises: Promise<void>[] = [];

        for (const [id, platform] of this.platforms) {
            const destroyPromise = platform.destroy()
                .then(() => {
                    console.log(`[PlatformRegistry] ✓ Destroyed platform: ${id}`);
                })
                .catch((err) => {
                    console.error(`[PlatformRegistry] ✗ Error destroying platform ${id}:`, err);
                });

            destroyPromises.push(destroyPromise);
        }

        await Promise.all(destroyPromises);

        this.platforms.clear();
        this.initialized = false;
        console.log('[PlatformRegistry] All platforms destroyed');
    }

    /**
     * Get health status of all platforms
     * 
     * @returns Map of platform ID to health status
     */
    async getHealthStatus(): Promise<Map<string, boolean>> {
        const healthStatus = new Map<string, boolean>();

        const healthPromises = Array.from(this.platforms.entries()).map(
            async ([id, platform]) => {
                try {
                    const isHealthy = await platform.healthCheck();
                    healthStatus.set(id, isHealthy);
                } catch (err) {
                    console.error(`[PlatformRegistry] Health check failed for ${id}:`, err);
                    healthStatus.set(id, false);
                }
            }
        );

        await Promise.all(healthPromises);

        return healthStatus;
    }

    /**
     * Get summary of registered platforms
     */
    getSummary(): {
        totalPlatforms: number;
        platforms: Array<{
            id: string;
            name: string;
            version: string;
            probeTypes: string[];
        }>;
    } {
        return {
            totalPlatforms: this.platforms.size,
            platforms: Array.from(this.platforms.values()).map(p => ({
                id: p.metadata.id,
                name: p.metadata.name,
                version: p.metadata.version,
                probeTypes: p.metadata.supportedProbeTypes
            }))
        };
    }
}
