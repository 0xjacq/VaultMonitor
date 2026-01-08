/**
 * EVM RPC Client with Circuit Breaker
 * 
 * Shared service for all EVM-based probes.
 * Handles RPC connections with resilience patterns.
 */

import { ethers } from 'ethers';
import { CircuitBreaker } from '../../../core/circuit-breaker';

export interface EvmRpcClientConfig {
    rpcUrl: string;
    chainId?: number;
    staticNetwork?: boolean;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
        halfOpenMaxAttempts: number;
    };
}

/**
 * RPC Client for EVM chains with Circuit Breaker protection
 */
export class EvmRpcClient {
    private provider: ethers.JsonRpcProvider;
    private circuitBreaker: CircuitBreaker;

    constructor(private config: EvmRpcClientConfig) {
        // Create ethers provider
        this.provider = new ethers.JsonRpcProvider(
            config.rpcUrl,
            config.chainId,
            {
                staticNetwork: config.staticNetwork ?? true,
                polling: false,
            }
        );

        // Initialize circuit breaker
        const cbConfig = config.circuitBreaker || {
            failureThreshold: 5,
            resetTimeout: 60000,  // 60s
            halfOpenMaxAttempts: 3
        };

        this.circuitBreaker = new CircuitBreaker(
            cbConfig,
            `RPC:${this.getRpcDisplayName()}`
        );
    }

    /**
     * Get current block number
     */
    async getBlockNumber(): Promise<number> {
        return this.circuitBreaker.execute(async () => {
            return await this.provider.getBlockNumber();
        });
    }

    /**
     * Call a contract method
     * 
     * @param contractAddress Contract address
     * @param abi Contract ABI
     * @param method Method name
     * @param args Method arguments
     * @returns Result from contract call
     */
    async callContract(
        contractAddress: string,
        abi: any[],
        method: string,
        args: any[] = []
    ): Promise<any> {
        return this.circuitBreaker.execute(async () => {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);

            // Explicit typing for dynamic method calls
            const result = await (contract[method] as any)(...args);
            return result;
        });
    }

    /**
     * Get contract
     * Useful for more complex interactions
     */
    getContract(contractAddress: string, abi: any[]): ethers.Contract {
        return new ethers.Contract(contractAddress, abi, this.provider);
    }

    /**
     * Get raw provider (use with caution - bypasses circuit breaker)
     */
    getRawProvider(): ethers.JsonRpcProvider {
        return this.provider;
    }

    /**
     * Check if RPC client is healthy
     */
    isHealthy(): boolean {
        return this.circuitBreaker.isHealthy();
    }

    /**
     * Get circuit breaker metrics
     */
    getMetrics() {
        return this.circuitBreaker.getMetrics();
    }

    /**
     * Get display name for RPC endpoint (for logging)
     */
    private getRpcDisplayName(): string {
        try {
            const url = new URL(this.config.rpcUrl);
            return url.hostname;
        } catch {
            return 'unknown';
        }
    }

    /**
     * Cleanup resources
     */
    async destroy(): Promise<void> {
        await this.provider.destroy();
    }
}
