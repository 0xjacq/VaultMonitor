/**
 * Main Entry Point (TypeScript)
 */
import { initDB } from './data/db';
import { ConfigLoader } from './utils/config-loader';
import { ProbeRunner } from './engine/runner';
import { ProbeFactory } from './engine/probe-factory';
import { RuleFactory } from './engine/rule-factory';
import { AlertManager } from './engine/alert-manager';
import { TelegramChannel } from './channels/telegram';
import { WebServer } from './web/server';
import * as path from 'path';


async function main() {
    try {
        // Initialize database
        initDB();

        // Load configuration
        const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config', 'config.yaml');
        console.log('[Main] Loading configuration from:', configPath);

        const config = ConfigLoader.load(configPath);
        console.log(`[Main] Loaded ${config.probes.length} probes`);

        // Initialize components
        const probeFactory = new ProbeFactory();
        const ruleFactory = new RuleFactory();
        const alertManager = new AlertManager();

        // Register notification channels
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const telegram = new TelegramChannel({
                token: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID
            });
            alertManager.registerChannel(telegram);
            console.log('[Main] Telegram channel registered');
        } else {
            console.warn('[Main] Telegram credentials not found, alerts will not be sent');
        }

        // Create and start runner
        const runner = new ProbeRunner(probeFactory, ruleFactory, alertManager);
        await runner.start(config);

        console.log('[Main] VaultMonitor started successfully');
        console.log('[Main] TypeScript migration complete - running in full TS mode');

        // Start web server
        const webServer = new WebServer(runner, alertManager);
        const port = parseInt(process.env.PORT || '3000');
        webServer.start(port);

    } catch (err) {
        console.error('[Main] Failed to start:', err);
        process.exit(1);
    }
}

// Start the application
main().catch(err => {
    console.error('[Main] Unhandled error:', err);
    process.exit(1);
});
