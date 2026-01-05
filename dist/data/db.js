"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDB = initDB;
/**
 * Database Setup (TypeScript)
 */
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const dbPath = path.join(process.cwd(), 'database.sqlite');
exports.db = new better_sqlite3_1.default(dbPath);
function initDB() {
    console.log('[DB] Initializing fresh database schema...');
    // Drop old tables for fresh start
    exports.db.exec(`DROP TABLE IF EXISTS probe_state`);
    exports.db.exec(`DROP TABLE IF EXISTS sent_alerts`);
    exports.db.exec(`DROP TABLE IF EXISTS run_history`);
    exports.db.exec(`DROP TABLE IF EXISTS cooldowns`);
    // 1. Probe State (namespaced: probe.* and rule.*)
    exports.db.exec(`
        CREATE TABLE probe_state (
            probe_id TEXT PRIMARY KEY,
            probe_json TEXT DEFAULT '{}',
            rule_json TEXT DEFAULT '{}',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // 2. Alert Deduplication (with TTL support)
    exports.db.exec(`
        CREATE TABLE sent_alerts (
            alert_id TEXT PRIMARY KEY,
            probe_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // 3. Cooldown Tracking (separate from dedup)
    exports.db.exec(`
        CREATE TABLE cooldowns (
            key TEXT PRIMARY KEY,
            last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // 4. Run History
    exports.db.exec(`
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
//# sourceMappingURL=db.js.map