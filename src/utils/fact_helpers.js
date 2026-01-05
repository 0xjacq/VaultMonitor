/**
 * Fact Helpers - Type-safe fact management
 */

/**
 * Set a fact with namespaced key validation
 * @param {Object} facts - Facts object
 * @param {string} key - Fact key (must match pattern: metric.*, evm.*, http.*)
 * @param {*} value - Fact value (number, string, boolean, bigint, null)
 */
function setFact(facts, key, value) {
    facts[key] = value;
}

/**
 * Get a fact by key
 * @param {Object} facts - Facts object
 * @param {string} key - Fact key
 * @returns {*} Fact value or undefined
 */
function getFact(facts, key) {
    return facts[key];
}

/**
 * Validate fact keys conform to namespacing pattern
 * @param {Object} facts - Facts object
 * @returns {string[]} Array of non-conforming keys
 */
function validateFactKeys(facts) {
    const invalidKeys = [];
    const validPattern = /^(metric|evm|http)\./;

    for (const key of Object.keys(facts)) {
        if (!validPattern.test(key)) {
            invalidKeys.push(key);
        }
    }

    if (invalidKeys.length > 0) {
        console.warn(`[Facts] Non-conforming keys detected: ${invalidKeys.join(', ')}`);
    }

    return invalidKeys;
}

module.exports = {
    setFact,
    getFact,
    validateFactKeys
};
