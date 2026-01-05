"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
/**
 * State Manager (TypeScript with new architecture)
 */
const db_1 = require("../data/db");
class StateManager {
    /**
     * Get probe state with namespaced structure
     */
    static getProbeState(probeId) {
        const stmt = db_1.db.prepare('SELECT probe_json, rule_json FROM probe_state WHERE probe_id = ?');
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
     */
    static saveProbeState(probeId, state) {
        const stmt = db_1.db.prepare(`
            INSERT INTO probe_state (probe_id, probe_json, rule_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(probe_id) DO UPDATE SET
                probe_json = excluded.probe_json,
                rule_json = excluded.rule_json,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(probeId, JSON.stringify(state.probe), JSON.stringify(state.rule));
    }
    /**
     * Check if alert has been sent (with optional TTL)
     */
    static isAlertSent(alertId, ttlMs) {
        const stmt = db_1.db.prepare('SELECT sent_at FROM sent_alerts WHERE alert_id = ?');
        const row = stmt.get(alertId);
        if (!row)
            return false;
        if (!ttlMs)
            return true;
        const sentAt = new Date(row.sent_at).getTime();
        return (Date.now() - sentAt) < ttlMs;
    }
    /**
     * Record sent alert
     */
    static recordAlert(alertId, probeId, ruleId) {
        const stmt = db_1.db.prepare('INSERT OR IGNORE INTO sent_alerts (alert_id, probe_id, rule_id, sent_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
        stmt.run(alertId, probeId, ruleId);
    }
    /**
     * Check if probe+rule combination is in cooldown
     */
    static isInCooldown(key, intervalMs) {
        const stmt = db_1.db.prepare('SELECT last_sent_at FROM cooldowns WHERE key = ?');
        const row = stmt.get(key);
        if (!row)
            return false;
        const lastSent = new Date(row.last_sent_at).getTime();
        return (Date.now() - lastSent) < intervalMs;
    }
    /**
     * Record cooldown for probe+rule
     */
    static recordCooldown(key) {
        const stmt = db_1.db.prepare(`
            INSERT INTO cooldowns (key, last_sent_at)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP
        `);
        stmt.run(key);
    }
    /**
     * Record probe run result
     */
    static recordRun(probeId, status, durationMs, errorMsg) {
        const stmt = db_1.db.prepare('INSERT INTO run_history (probe_id, status, duration_ms, error_message) VALUES (?, ?, ?, ?)');
        stmt.run(probeId, status, durationMs, errorMsg || null);
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=state-manager.js.map