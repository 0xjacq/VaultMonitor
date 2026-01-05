/**
 * EVM Call Probe (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { EvmCallConfig } from '../types/config';
import { Facts, ProbeState, FactValue } from '../types/domain';
import { setFact } from '../utils/fact-helpers';
import { ethers } from 'ethers';

export class EvmCallProbe extends BaseProbe<EvmCallConfig> {
    private readonly provider: ethers.JsonRpcProvider;

    constructor(id: string, config: EvmCallConfig) {
        super(id, config);

        this.provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
            staticNetwork: true,
            polling: false,
        });
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};

        // Store block number as evm.block
        const block = await this.provider.getBlockNumber();
        setFact(facts, 'evm.block', block);

        for (const call of this.config.calls) {
            try {
                const contract = new ethers.Contract(call.target, call.abi, this.provider);

                // Explicit as any for dynamic method calls
                const result = await (contract[call.method] as any)(...(call.args ?? []));

                // Store raw value as metric.<name>
                setFact(facts, `metric.${call.name}`, this.normalizeValue(result));

                // Store formatted value as metric.<name>_formatted
                if (call.decimals !== undefined) {
                    const formatted = ethers.formatUnits(result, call.decimals);
                    setFact(facts, `metric.${call.name}_formatted`, formatted);
                }
            } catch (err) {
                console.error(`[EvmCallProbe:${this.id}] Call ${call.name} failed:`, err);
                setFact(facts, `metric.${call.name}`, null);
            }
        }

        // Update probe state with last block
        state.probe = { ...state.probe, last_block: block };

        return facts;
    }

    private normalizeValue(value: any): FactValue {
        if (value === null || value === undefined) return null;
        if (typeof value === 'bigint') return value; // Keep bigint
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        return String(value);
    }
}
