/**
 * Base Platform Interface
 * 
 * All platforms (Pendle, Aave, EVM, etc.) must extend this abstract class.
 * This provides a standardized interface for platform initialization, probe creation,
 * and lifecycle management.
 */

import { BaseProbe } from '../core/base-probe';
import { ProbeConfig } from '../types/config';

/**
 * Platform metadata - identifies the platform and its capabilities
 */
export interface PlatformMetadata {
    id: string;                    // Unique identifier (e.g., 'pendle', 'aave')
    name: string;                  // Human-readable name (e.g., 'Pendle Finance')
    version: string;               // Platform adapter version
    supportedProbeTypes: string[]; // List of probe types this platform can create
}

/**
 * Platform configuration - passed during initialization
 */
export interface PlatformConfig {
    enabled: boolean;
    // Platform-specific config extends this interface
    [key: string]: any;
}

/**
 * Abstract base class for all platforms
 * 
 * Lifecycle:
 * 1. Constructor - Create platform instance
 * 2. initialize(config) - Set up clients, validate config
 * 3. createProbe(type, config) - Create probe instances (called multiple times)
 * 4. destroy() - Cleanup resources on shutdown
 */
export abstract class BasePlatform {
    /**
     * Platform metadata - must be defined by implementing classes
     */
    abstract readonly metadata: PlatformMetadata;

    /**
     * Initialize the platform with configuration
     * 
     * This is where you should:
     * - Create API clients
     * - Validate configuration
     * - Set up shared resources
     * - Initialize circuit breakers
     * 
     * @param config Platform-specific configuration
     * @throws Error if configuration is invalid
     */
    abstract initialize(config: PlatformConfig): Promise<void>;

    /**
     * Create a probe instance for this platform
     * 
     * @param type Probe type (must be in supportedProbeTypes)
     * @param config Probe configuration (platform-based config)
     * @returns BaseProbe instance
     * @throws Error if probe type is not supported
     */
    abstract createProbe(type: string, config: any): BaseProbe;

    /**
     * Cleanup resources
     * 
     * Called when the application is shutting down.
     * Clean up:
     * - API clients
     * - Circuit breakers
     * - Any other resources
     */
    abstract destroy(): Promise<void>;

    /**
     * Health check - optional override
     * 
     * @returns true if platform is healthy, false otherwise
     */
    async healthCheck(): Promise<boolean> {
        return true;
    }

    /**
     * Helper to validate probe type is supported
     * 
     * @param type Probe type to validate
     * @throws Error if type is not supported
     */
    protected validateProbeType(type: string): void {
        if (!this.metadata.supportedProbeTypes.includes(type)) {
            throw new Error(
                `Platform ${this.metadata.id} does not support probe type: ${type}. ` +
                `Supported types: ${this.metadata.supportedProbeTypes.join(', ')}`
            );
        }
    }
}
