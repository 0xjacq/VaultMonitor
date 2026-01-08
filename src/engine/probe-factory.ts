/**
 * Probe Factory (Platform-Based Architecture)
 * 
 * Creates probes by delegating to the appropriate platform.
 * No longer hardcodes probe types - platforms handle their own probe creation.
 */
import { BaseProbe } from '../core/base-probe';
import { PlatformProbeConfig } from '../types/platform-config';
import { PlatformRegistry } from './platform-registry';

export class ProbeFactory {
    constructor(private readonly platformRegistry: PlatformRegistry) { }

    /**
     * Create a probe using the platform-based architecture
     * 
     * @param config Platform-based probe configuration
     * @returns BaseProbe instance
     * @throws Error if platform not found or probe type not supported
     */
    create(config: PlatformProbeConfig): BaseProbe {
        // Get the platform for this probe
        const platform = this.platformRegistry.get(config.platform);

        if (!platform) {
            throw new Error(
                `Platform not found: ${config.platform}. ` +
                `Available platforms: ${this.platformRegistry.getPlatformIds().join(', ')}`
            );
        }

        // Validate that the platform supports this probe type
        if (!platform.metadata.supportedProbeTypes.includes(config.type)) {
            throw new Error(
                `Platform ${config.platform} does not support probe type: ${config.type}. ` +
                `Supported types: ${platform.metadata.supportedProbeTypes.join(', ')}`
            );
        }

        // Delegate probe creation to the platform
        return platform.createProbe(config.type, config);
    }
}
