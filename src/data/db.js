const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath); // verbose: console.log

function initDB() {
    console.log('[DB] Initializing fresh database schema...');

    // Drop old tables for fresh start
    db.exec(`DROP TABLE IF EXISTS probe_state`);
    db.exec(`DROP TABLE IF EXISTS sent_alerts`);
    db.exec(`DROP TABLE IF EXISTS run_history`);
    db.exec(`DROP TABLE IF EXISTS cooldowns`);

    // 1. Probe State (namespaced: probe.* and rule.*)
    db.exec(`
        CREATE TABLE probe_state (
            probe_id TEXT PRIMARY KEY,
            probe_json TEXT DEFAULT '{}',
            rule_json TEXT DEFAULT '{}',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Alert Deduplication (with TTL support)
    db.exec(`
        CREATE TABLE sent_alerts (
            alert_id TEXT PRIMARY KEY,
            probe_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. Cooldown Tracking (separate from dedup)
    db.exec(`
        CREATE TABLE cooldowns (
            key TEXT PRIMARY KEY,
            last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4. Run History (unchanged)
    db.exec(`
        CREATE TABLE run_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            probe_id TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('[DB] Database initialized at', dbPath);
}

module.exports = { db, initDB };
