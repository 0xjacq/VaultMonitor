const BaseProbe = require('../core/base_probe');
const { ethers } = require('ethers');

class EvmCallProbe extends BaseProbe {
    /**
     * Config:
     * - rpcUrl: string
     * - calls: Array<{ name: string, target: string, abi: string[], method: string, args: [] }>
     */
    constructor(id, config) {
        super(id, config);
        if (!config.rpcUrl) throw new Error('EvmCallProbe requires rpcUrl');
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    }

    async run(state) {
        const facts = {};
        const context = { block: await this.provider.getBlockNumber() };

        // Execute calls
        // In V2, we can batch or run individually.
        for (const call of this.config.calls) {
            try {
                const contract = new ethers.Contract(call.target, call.abi, this.provider);
                const result = await contract[call.method](...(call.args || []));

                // Normalize result (handle BigInt)
                facts[call.name] = result;
                // formatted version often needed for rules/messages
                if (call.decimals) {
                    facts[`${call.name}_formatted`] = ethers.formatUnits(result, call.decimals);
                } else {
                    facts[`${call.name}_formatted`] = result.toString();
                }

            } catch (err) {
                console.error(`[EvmCallProbe:${this.id}] Call ${call.name} failed:`, err.message);
                facts[call.name] = null;
            }
        }

        // Evaluate Rules
        const alerts = await this.evaluate(facts, { ...state, ...context });

        // Return alerts + potentially updated state if we want to store last values inside rules? 
        // No, state management is usually done by saving the "facts" found if needed for change detection.
        // For ChangeRule, we need the *previous* value. 
        // So we should attach `state.data` to context so rules can see it.

        return alerts;
    }
}

module.exports = EvmCallProbe;
