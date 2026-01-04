/**
 * Base class for all Rules.
 * A Rule evaluates facts and determines if an alert should be triggered.
 */
class BaseRule {
    /**
     * @param {string} id - Unique identifier for the rule (e.g. 'cap_threshold')
     * @param {Object} config - Thresholds, limits, etc.
     */
    constructor(id, config) {
        this.id = id;
        this.config = config || {};
    }

    /**
     * Evaluate facts and return an Alert if triggered.
     * @param {Object} facts - The data collected by the probe
     * @param {Object} context - Shared context (e.g. state)
     * @returns {Object|null} - Alert object or null
     */
    async evaluate(facts, context) {
        throw new Error('evaluate() must be implemented by subclass');
    }
}

module.exports = BaseRule;
