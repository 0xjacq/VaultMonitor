const BaseRule = require('../core/base_rule');
const { Severity } = require('../core/types');

class ChangeRule extends BaseRule {
    /**
     * Config:
     * - fact: string (key to watch)
     * - severity: string
     * - title: string
     */
    async evaluate(facts, context) {
        const currentVal = facts[this.config.fact];
        if (currentVal === undefined) return null;

        const stateKey = `rule_${this.id}_last_value`;
        const lastVal = context.data ? context.data[stateKey] : undefined;

        // Save current value for next run
        if (context.data) context.data[stateKey] = currentVal.toString();

        if (lastVal !== undefined && lastVal !== currentVal.toString()) {
            return {
                id: `${this.id}_${context.block || Date.now()}`,
                probeId: context.probeId,
                ruleId: this.id,
                severity: this.config.severity || Severity.INFO,
                title: this.config.title || 'Value Changed',
                message: `Value changed from ${lastVal} to ${currentVal}`,
                timestamp: Date.now(),
                entities: {
                    Old: lastVal,
                    New: currentVal.toString()
                }
            };
        }

        return null;
    }
}

module.exports = ChangeRule;
