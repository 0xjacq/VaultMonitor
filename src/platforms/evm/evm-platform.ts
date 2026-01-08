/**
 * EVM Platform
 * 
 * Platform adapter for Ethereum Virtual Machine compatible chains.
 * Supports any EVM chain via RPC endpoint.
 */

import { BasePlatform, PlatformMetadata, PlatformConfig } from '../base-platform';
import { BaseProbe } from '../../core/base-probe';
import { EvmRpcClient } from './services/evm-rpc-client';
import { ContractCallProbe } from './probes/contract-call';

export interface EvmPlatformConfig extends PlatformConfig {
    defaultRpcUrls?: Record<number, string>;  // chainId -> RPC URL
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * EVM Platform - supports contract calls, event listening, balance tracking
 */
export class EvmPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'evm',
        name: 'EVM (Ethereum Virtual Machine)',
        version: '1.0.0',
        supportedProbeTypes: [
            'contract_call',
            // Future: 'event_listener', 'balance_tracker', 'transaction_tracker'
        ],
    };

    private rpcClients = new Map<string, EvmRpcClient>();
    private platformConfig?: EvmPlatformConfig;

    async initialize(config: PlatformConfig): Promise<void> {
        this.platformConfig = config as EvmPlatformConfig;
        console.log('[EvmPlatform] Initialized');
    }

    createProbe(type: string, config: any): BaseProbe {
        this.validateProbeType(type);

        switch (type) {
            case 'contract_call':
                return new ContractCallProbe(
                    config.id,
                    config,
                    this.getOrCreateRpcClient(config.config.rpcUrl, config.config.chainId)
                );
            default:
                throw new Error(`EVM probe type not implemented: ${type}`);
        }
    }

    async destroy(): Promise<void> {
        // Destroy all RPC clients
        const destroyPromises = Array.from(this.rpcClients.values()).map(
            client => client.destroy()
        );
        await Promise.allSettled(destroyPromises);

        this.rpcClients.clear();
        console.log('[EvmPlatform] Destroyed');
    }

    async healthCheck(): Promise<boolean> {
        // Platform is healthy if at least one RPC client is healthy
        for (const client of this.rpcClients.values()) {
            if (client.isHealthy()) {
                return true;
            }
        }

        // If no clients yet, consider healthy
        return this.rpcClients.size === 0;
    }

    /**
     * Get or create an RPC client for a specific RPC URL
     * Reuses clients for the same URL to share circuit breakers
     */
    private getOrCreateRpcClient(rpcUrl: string, chainId?: number): EvmRpcClient {
        const key = rpcUrl;

        if (!this.rpcClients.has(key)) {
            const client = new EvmRpcClient({
                rpcUrl,
                chainId,
                staticNetwork: true,
                circuitBreaker: this.platformConfig?.circuitBreaker
            });

            this.rpcClients.set(key, client);
            console.log(`[EvmPlatform] Created RPC client for ${rpcUrl}`);
        }

        return this.rpcClients.get(key)!;
    }
}
