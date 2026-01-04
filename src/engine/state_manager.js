const { db } = require('../data/db');

class StateManager {
    static getProbeState(probeId) {
        const stmt = db.prepare('SELECT * FROM probe_state WHERE probe_id = ?');
        const row = stmt.get(probeId);
        if (!row) return null;
        return {
            ...row,
            data: row.data ? JSON.parse(row.data) : {}
        };
    }

    static saveProbeState(probeId, state) {
        // state = { lastBlock, data: {} }
        const current = this.getProbeState(probeId) || {};

        const lastBlock = state.lastBlock !== undefined ? state.lastBlock : (current.last_block || 0);
        const data = state.data ? JSON.stringify(state.data) : (JSON.stringify(current.data || {}));

        const stmt = db.prepare(`
            INSERT INTO probe_state (probe_id, last_block, data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(probe_id) DO UPDATE SET
                last_block = excluded.last_block,
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(probeId, lastBlock, data);
    }

    static isAlertSent(alertId) {
        const stmt = db.prepare('SELECT 1 FROM sent_alerts WHERE alert_id = ?');
        return !!stmt.get(alertId);
    }

    static recordAlert(alertId, probeId, ruleId) {
        const stmt = db.prepare('INSERT OR IGNORE INTO sent_alerts (alert_id, probe_id, rule_id) VALUES (?, ?, ?)');
        stmt.run(alertId, probeId, ruleId);
    }

    static recordRun(probeId, status, durationMs, errorMsg = null) {
        const stmt = db.prepare('INSERT INTO run_history (probe_id, status, duration_ms, error_message) VALUES (?, ?, ?, ?)');
        stmt.run(probeId, status, durationMs, errorMsg);
    }
}

module.exports = StateManager;
