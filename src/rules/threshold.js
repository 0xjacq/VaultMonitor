const BaseRule = require('../core/base_rule');
const { Severity } = require('../core/types');
const StateManager = require('../engine/state_manager');

class ThresholdRule extends BaseRule {
    /**
     * Config:
     * - fact: string (key)
     * - outputFact: string (optional, checks formatted version)
     * - threshold: number
     * - operator: '>', '>=', '<', '<='
     * - severity: 'info' | 'warning' | 'critical'
     * - title: string
     * - messageTemplate: string (interpolates ${value}, ${threshold})
     */
    async evaluate(facts, context) {
        const valRaw = facts[this.config.fact];
        if (valRaw === undefined || valRaw === null) return null;

        let val = parseFloat(valRaw);
        // If config specifies reading a formatted fact string
        if (typeof valRaw === 'string') val = parseFloat(valRaw);
        // If config says "useFormatted", we might look at that property instead
        // But let's assume `val` is the number to compare.
        // For BigInts (ethers), we should use formatted typically for user config flexibility (50M vs 50000000000000).

        const threshold = parseFloat(this.config.threshold);
        let triggered = false;

        switch (this.config.operator) {
            case '>': triggered = val > threshold; break;
            case '>=': triggered = val >= threshold; break;
            case '<': triggered = val < threshold; break;
            case '<=': triggered = val <= threshold; break;
        }

        if (triggered) {
            // Check state for deduplication/spam if needed?
            // "Crossing" logic: only fire if PREVIOUSLY it was safe.
            // This requires access to state.
            const stateKey = `rule_${this.id}_last_status`;
            const lastStatus = context.data ? context.data[stateKey] : 'ok';

            // Only alert if we just crossed into danger zone (or if allowRepeats is true)
            // But if we want to reset state when it goes back to normal:

            if (lastStatus === 'ok') {
                // UPDATE STATE: We crossed
                // Note: Updating state inside rule is tricky. 
                // We'll rely on the Runner to ignore state updates from rules or we need a mechanism.
                // Creating a special "SideEffect" return or just modifying context.data reference if mutable.
                // Assuming context.data is mutable and saved by Runner.
                if (context.data) context.data[stateKey] = 'triggered';

                return {
                    id: `${this.id}_${context.block || Date.now()}`,
                    probeId: context.probeId, // Passed by probe? Probe needs to pass this.
                    ruleId: this.id,
                    severity: this.config.severity || Severity.WARNING,
                    title: this.config.title || 'Threshold Breached',
                    message: this.formatMessage(val, threshold),
                    timestamp: Date.now(),
                    entities: {
                        Value: val.toLocaleString(),
                        Threshold: threshold.toLocaleString()
                    }
                };
            }
        } else {
            // Reset state if back to normal
            if (context.data) context.data[stateKey] = 'ok';
        }

        return null;
    }

    formatMessage(val, threshold) {
        if (!this.config.messageTemplate) return `Value ${val} crossed threshold ${threshold}`;
        return this.config.messageTemplate
            .replace('${value}', val.toLocaleString())
            .replace('${threshold}', threshold.toLocaleString());
    }
}

module.exports = ThresholdRule;
