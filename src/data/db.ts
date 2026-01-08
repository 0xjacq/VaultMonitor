/**
 * Database Setup (TypeScript)
 *
 * Uses CREATE TABLE IF NOT EXISTS to preserve data across restarts.
 * Schema is automatically ensured when module is loaded.
 */
import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
export const db: Database.Database = new Database(dbPath);

/**
 * Ensure database schema exists without dropping existing data.
 * Safe to call multiple times - uses CREATE TABLE IF NOT EXISTS.
 */
export function ensureSchema(): void {
    // 1. Probe State (namespaced: probe.* and rule.*)
    db.exec(`
        CREATE TABLE IF NOT EXISTS probe_state (
            probe_id TEXT PRIMARY KEY,
            probe_json TEXT DEFAULT '{}',
            rule_json TEXT DEFAULT '{}',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Alert Deduplication (with TTL support)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sent_alerts (
            alert_id TEXT PRIMARY KEY,
            probe_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Index for cleanup queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_alerts_sent_at ON sent_alerts(sent_at)`);

    // 3. Cooldown Tracking (separate from dedup)
    db.exec(`
        CREATE TABLE IF NOT EXISTS cooldowns (
            key TEXT PRIMARY KEY,
            last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4. Run History
    db.exec(`
        CREATE TABLE IF NOT EXISTS run_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            probe_id TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Index for recent runs queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_run_history_created_at ON run_history(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_run_history_probe_id ON run_history(probe_id)`);

    console.log('[DB] Schema ensured at', dbPath);
}

/**
 * Reset database for testing - drops all tables and recreates schema.
 * WARNING: This will delete all data!
 */
export function resetDatabase(): void {
    console.log('[DB] Resetting database (dropping all tables)...');
    db.exec(`DROP TABLE IF EXISTS probe_state`);
    db.exec(`DROP TABLE IF EXISTS sent_alerts`);
    db.exec(`DROP TABLE IF EXISTS run_history`);
    db.exec(`DROP TABLE IF EXISTS cooldowns`);
    ensureSchema();
    console.log('[DB] Database reset complete');
}

// Automatically ensure schema on module load
ensureSchema();
