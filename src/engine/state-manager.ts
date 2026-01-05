/**
 * State Manager (TypeScript with new architecture)
 */
import { db } from '../data/db';
import { ProbeState } from '../types/domain';

export class StateManager {
    /**
     * Get probe state with namespaced structure
     */
    static getProbeState(probeId: string): ProbeState {
        const stmt = db.prepare('SELECT probe_json, rule_json FROM probe_state WHERE probe_id = ?');
        const row = stmt.get(probeId) as any;

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
    static saveProbeState(probeId: string, state: ProbeState): void {
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
            JSON.stringify(state.probe),
            JSON.stringify(state.rule)
        );
    }

    /**
     * Check if alert has been sent (with optional TTL)
     */
    static isAlertSent(alertId: string, ttlMs?: number): boolean {
        const stmt = db.prepare('SELECT sent_at FROM sent_alerts WHERE alert_id = ?');
        const row = stmt.get(alertId) as any;

        if (!row) return false;
        if (!ttlMs) return true;

        const sentAt = new Date(row.sent_at).getTime();
        return (Date.now() - sentAt) < ttlMs;
    }

    /**
     * Record sent alert
     */
    static recordAlert(alertId: string, probeId: string, ruleId: string): void {
        const stmt = db.prepare(
            'INSERT OR IGNORE INTO sent_alerts (alert_id, probe_id, rule_id, sent_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        );
        stmt.run(alertId, probeId, ruleId);
    }

    /**
     * Check if probe+rule combination is in cooldown
     */
    static isInCooldown(key: string, intervalMs: number): boolean {
        const stmt = db.prepare('SELECT last_sent_at FROM cooldowns WHERE key = ?');
        const row = stmt.get(key) as any;

        if (!row) return false;

        const lastSent = new Date(row.last_sent_at).getTime();
        return (Date.now() - lastSent) < intervalMs;
    }

    /**
     * Record cooldown for probe+rule
     */
    static recordCooldown(key: string): void {
        const stmt = db.prepare(`
            INSERT INTO cooldowns (key, last_sent_at)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET last_sent_at = CURRENT_TIMESTAMP
        `);
        stmt.run(key);
    }

    /**
     * Record probe run result
     */
    static recordRun(probeId: string, status: string, durationMs: number, errorMsg?: string): void {
        const stmt = db.prepare('INSERT INTO run_history (probe_id, status, duration_ms, error_message) VALUES (?, ?, ?, ?)');
        stmt.run(probeId, status, durationMs, errorMsg || null);
    }
}
