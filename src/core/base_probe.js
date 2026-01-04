/**
 * Base class for all Probes.
 * A Probe is a job that runs periodically to collect facts and evaluate rules.
 */
class BaseProbe {
    /**
     * @param {string} id - Unique identifier for the probe instance (e.g. 'usd3_monitor')
     * @param {Object} config - Configuration object
     */
    constructor(id, config) {
        this.id = id;
        this.config = config || {};
        this.rules = [];
    }

    /**
     * Add a rule to this probe.
     * @param {BaseRule} rule
     */
    addRule(rule) {
        this.rules.push(rule);
    }

    /**
     * Main execution method.
     * Should be overridden by subclasses to collect facts (this.collect())
     * and then call this.evaluate(facts).
     */
    async run() {
        throw new Error('run() must be implemented by subclass');
    }

    /**
     * Evaluate collected facts against all rules.
     * @param {Object} facts - Dictionary of normalized facts (e.g. { supplyCap: 50000 })
     * @param {Object} context - Additional context (e.g. current block)
     * @returns {Array<Alert>} - List of triggered alerts
     */
    async evaluate(facts, context = {}) {
        const alerts = [];
        for (const rule of this.rules) {
            try {
                const result = await rule.evaluate(facts, context);
                if (result) {
                    // Result can be a single alert or array of alerts
                    if (Array.isArray(result)) alerts.push(...result);
                    else alerts.push(result);
                }
            } catch (err) {
                console.error(`[Probe:${this.id}] Rule ${rule.id} failed:`, err.message);
            }
        }
        return alerts;
    }
}

module.exports = BaseProbe;
