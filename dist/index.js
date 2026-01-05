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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Main Entry Point (TypeScript)
 */
const db_1 = require("./data/db");
const config_loader_1 = require("./utils/config-loader");
const runner_1 = require("./engine/runner");
const probe_factory_1 = require("./engine/probe-factory");
const rule_factory_1 = require("./engine/rule-factory");
const alert_manager_1 = require("./engine/alert-manager");
const telegram_1 = require("./channels/telegram");
const server_1 = require("./web/server");
const path = __importStar(require("path"));
async function main() {
    try {
        // Initialize database
        (0, db_1.initDB)();
        // Load configuration
        const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config', 'config.yaml');
        console.log('[Main] Loading configuration from:', configPath);
        const config = config_loader_1.ConfigLoader.load(configPath);
        console.log(`[Main] Loaded ${config.probes.length} probes`);
        // Initialize components
        const probeFactory = new probe_factory_1.ProbeFactory();
        const ruleFactory = new rule_factory_1.RuleFactory();
        const alertManager = new alert_manager_1.AlertManager();
        // Register notification channels
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const telegram = new telegram_1.TelegramChannel({
                token: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID
            });
            alertManager.registerChannel(telegram);
            console.log('[Main] Telegram channel registered');
        }
        else {
            console.warn('[Main] Telegram credentials not found, alerts will not be sent');
        }
        // Create and start runner
        const runner = new runner_1.ProbeRunner(probeFactory, ruleFactory, alertManager);
        await runner.start(config);
        console.log('[Main] VaultMonitor started successfully');
        console.log('[Main] TypeScript migration complete - running in full TS mode');
        // Start web server
        const webServer = new server_1.WebServer(runner, alertManager);
        const port = parseInt(process.env.PORT || '3000');
        webServer.start(port);
    }
    catch (err) {
        console.error('[Main] Failed to start:', err);
        process.exit(1);
    }
}
// Start the application
main().catch(err => {
    console.error('[Main] Unhandled error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map