const { db } = require('../data/db');

class StateManager {
    /**
     * Get probe state with namespaced structure
     * @param {string} probeId
     * @returns {{ probe: Object, rule: Object }} State object or default
     */
    static getProbeState(probeId) {
        const stmt = db.prepare('SELECT probe_json, rule_json FROM probe_state WHERE probe_id = ?');
        const row = stmt.get(probeId);

        if (!row) {
            return { probe: {}, rule: {} };
        }

        return {
            probe: row.probe_json ? JSON.parse(row.probe_json) : {},
            rule: row.rule_json ? JSON.parse(row.rule_json) : {}
        };
    }

    /**
     * Save probe state (namespaced)
     * @param {string} probeId
     * @param {{ probe: Object, rule: Object }} state
     */
    static saveProbeState(probeId, state) {
        const stmt = db.prepare(`
            INSERT INTO probe_state (probe_id, probe_json, rule_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(probe_id) DO UPDATE SET
                probe_json = excluded.probe_json,
                rule_json = excluded.rule_json,
                updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(
            probeId,
            JSON.stringify(state.probe || {}),
            JSON.stringify(state.rule || {})
        );
    }

    /**
     * Check if alert has been sent (with optional TTL)
     * @param {string} alertId
     * @param {number} [ttlMs] - TTL in milliseconds
     * @returns {boolean}
     */
    static isAlertSent(alertId, ttlMs = null) {
        const stmt = db.prepare('SELECT sent_at FROM sent_alerts WHERE alert_id = ?');
        const row = stmt.get(alertId);

        if (!row) return false;
        if (!ttlMs) return true; // No TTL = permanent dedup

        const sentAt = new Date(row.sent_at).getTime();
        return (Date.now() - sentAt) < ttlMs;
    }

    /**
     * Record sent alert
     * @param {string} alertId
     * @param {string} probeId
     * @param {string} ruleId
     */
    static recordAlert(alertId, probeId, ruleId) {
        const stmt = db.prepare(
            'INSERT OR IGNORE INTO sent_alerts (alert_id, probe_id, rule_id, sent_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        );
        stmt.run(alertId, probeId, ruleId);
    }

    /**
     * Check if probe+rule combination is in cooldown
     * @param {string} key - Format: "probeId:ruleId"
     * @param {number} intervalMs - Cooldown interval in milliseconds
     * @returns {boolean}
     */
    static isInCooldown(key, intervalMs) {
        const stmt = db.prepare('SELECT last_sent_at FROM cooldowns WHERE key = ?');
        const row = stmt.get(key);

        if (!row) return false;

        const lastSent = new Date(row.last_sent_at).getTime();
        return (Date.now() - lastSent) < intervalMs;
    }

    /**
     * Record cooldown for probe+rule
     * @param {string} key - Format: "probeId:ruleId"
     */
    static recordCooldown(key) {
        const stmt = db.prepare(`
            INSERT INTO cooldowns (key, last_sent_at)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP
        `);
        stmt.run(key);
    }

    /**
     * Record probe run result
     * @param {string} probeId
     * @param {string} status - 'success' or 'error'
     * @param {number} durationMs
     * @param {string} [errorMsg]
     */
    static recordRun(probeId, status, durationMs, errorMsg = null) {
        const stmt = db.prepare('INSERT INTO run_history (probe_id, status, duration_ms, error_message) VALUES (?, ?, ?, ?)');
        stmt.run(probeId, status, durationMs, errorMsg);
    }
}

}

module.exports = StateManager;

module.exports = StateManager;
