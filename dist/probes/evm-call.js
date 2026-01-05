"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvmCallProbe = void 0;
/**
 * EVM Call Probe (TypeScript)
 */
const base_probe_1 = require("../core/base-probe");
const fact_helpers_1 = require("../utils/fact-helpers");
const ethers_1 = require("ethers");
class EvmCallProbe extends base_probe_1.BaseProbe {
    provider;
    constructor(id, config) {
        super(id, config);
        this.provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl, undefined, {
            staticNetwork: true,
            polling: false,
        });
    }
    async collect(state) {
        const facts = {};
        // Store block number as evm.block
        const block = await this.provider.getBlockNumber();
        (0, fact_helpers_1.setFact)(facts, 'evm.block', block);
        for (const call of this.config.calls) {
            try {
                const contract = new ethers_1.ethers.Contract(call.target, call.abi, this.provider);
                // Explicit as any for dynamic method calls
                const result = await contract[call.method](...(call.args ?? []));
                // Store raw value as metric.<name>
                (0, fact_helpers_1.setFact)(facts, `metric.${call.name}`, this.normalizeValue(result));
                // Store formatted value as metric.<name>_formatted
                if (call.decimals !== undefined) {
                    const formatted = ethers_1.ethers.formatUnits(result, call.decimals);
                    (0, fact_helpers_1.setFact)(facts, `metric.${call.name}_formatted`, formatted);
                }
            }
            catch (err) {
                console.error(`[EvmCallProbe:${this.id}] Call ${call.name} failed:`, err);
                (0, fact_helpers_1.setFact)(facts, `metric.${call.name}`, null);
            }
        }
        // Update probe state with last block
        state.probe = { ...state.probe, last_block: block };
        return facts;
    }
    normalizeValue(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value === 'bigint')
            return value; // Keep bigint
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        return String(value);
    }
}
exports.EvmCallProbe = EvmCallProbe;
//# sourceMappingURL=evm-call.js.map