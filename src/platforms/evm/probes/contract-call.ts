/**
 * Contract Call Probe (EVM Platform)
 * 
 * Migrated from legacy evm-call.ts
 * Now uses EvmRpcClient with Circuit Breaker protection
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState, FactValue } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { EvmRpcClient } from '../services/evm-rpc-client';
import { ethers } from 'ethers';

export interface ContractCall {
    name: string;
    target: string;        // Contract address
    abi: any[];
    method: string;
    args?: any[];
    decimals?: number;     // For formatting token amounts
}

export interface ContractCallProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        rpcUrl: string;
        chainId?: number;
        calls: ContractCall[];
    };
    rules?: any[];
}

/**
 * Contract Call Probe - calls smart contract methods and collects results
 */
export class ContractCallProbe extends BaseProbe<ContractCallProbeConfig> {
    constructor(
        id: string,
        config: ContractCallProbeConfig,
        private readonly rpcClient: EvmRpcClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};

        try {
            // Get current block number
            const block = await this.rpcClient.getBlockNumber();
            setFact(facts, 'evm.block', block);

            // Execute all contract calls
            for (const call of this.config.config.calls) {
                try {
                    const result = await this.rpcClient.callContract(
                        call.target,
                        call.abi,
                        call.method,
                        call.args ?? []
                    );

                    // Store raw value as evm.<name>
                    setFact(facts, `evm.${call.name}`, this.normalizeValue(result));

                    // Store formatted value if decimals specified
                    if (call.decimals !== undefined) {
                        const formatted = ethers.formatUnits(result, call.decimals);
                        setFact(facts, `evm.${call.name}_formatted`, formatted);
                    }
                } catch (err) {
                    console.error(`[ContractCallProbe:${this.id}] Call ${call.name} failed:`, err);
                    setFact(facts, `evm.${call.name}`, null);
                }
            }

            // Update probe state
            state.probe = { ...state.probe, last_block: block };
        } catch (err) {
            console.error(`[ContractCallProbe:${this.id}] Failed to get block number:`, err);
            setFact(facts, 'evm.block', null);
        }

        return facts;
    }

    private normalizeValue(value: any): FactValue {
        if (value === null || value === undefined) return null;
        if (typeof value === 'bigint') return value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        return String(value);
    }
}
