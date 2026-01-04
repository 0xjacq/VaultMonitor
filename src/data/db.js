const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath); // verbose: console.log

function initDB() {
    // 1. Probe State
    // Stores the last known state for each probe (e.g. last block scanned, last value seen)
    db.exec(`
        CREATE TABLE IF NOT EXISTS probe_state (
            probe_id TEXT PRIMARY KEY,
            last_block INTEGER DEFAULT 0,
            data JSON, -- Stores arbitrary state like { lastCap: "...", lastImpl: "..." }
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Alert Deduplication
    // Tracks sent alerts to prevent duplicates based on config rules
    db.exec(`
        CREATE TABLE IF NOT EXISTS sent_alerts (
            alert_id TEXT PRIMARY KEY,
            probe_id TEXT,
            rule_id TEXT,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. Run History (Health/Metrics)
    // Tracks execution status of each probe run
    db.exec(`
        CREATE TABLE IF NOT EXISTS run_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            probe_id TEXT,
            status TEXT, -- 'success', 'error'
            duration_ms INTEGER,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Periodic cleanup for run_history can be added later
    console.log('[DB] Database initialized at', dbPath);
}

module.exports = { db, initDB };
