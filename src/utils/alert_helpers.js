const crypto = require('crypto');

/**
 * Alert Helpers - Generate consistent alert IDs
 */

/**
 * Generate a stable alert ID
 * @param {string} probeId - Probe identifier
 * @param {string} ruleId - Rule identifier
 * @param {string} stableKey - Stable key for the alert (e.g., 'breach', txHash, hash of change)
 * @returns {string} Alert ID in format: probeId:ruleId:stableKey
 */
function generateAlertId(probeId, ruleId, stableKey) {
    return `${probeId}:${ruleId}:${stableKey}`;
}

/**
 * Create a hash for change-based alerts
 * @param {string} input - Input string to hash (e.g., "oldValue->newValue")
 * @returns {string} First 8 characters of SHA-256 hash
 */
function createHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

/**
 * Generate alert ID for threshold rule
 * @param {string} probeId
 * @param {string} ruleId
 * @returns {string}
 */
function generateThresholdAlertId(probeId, ruleId) {
    return generateAlertId(probeId, ruleId, 'breach');
}

/**
 * Generate alert ID for change rule
 * @param {string} probeId
 * @param {string} ruleId
 * @param {*} oldValue
 * @param {*} newValue
 * @returns {string}
 */
function generateChangeAlertId(probeId, ruleId, oldValue, newValue) {
    const stableKey = createHash(`${oldValue}->${newValue}`);
    return generateAlertId(probeId, ruleId, stableKey);
}

/**
 * Generate alert ID for event rule
 * @param {string} probeId
 * @param {string} ruleId
 * @param {string} eventIdentifier - e.g., transaction hash
 * @returns {string}
 */
function generateEventAlertId(probeId, ruleId, eventIdentifier) {
    return generateAlertId(probeId, ruleId, eventIdentifier);
}

module.exports = {
    generateAlertId,
    createHash,
    generateThresholdAlertId,
    generateChangeAlertId,
    generateEventAlertId
};
