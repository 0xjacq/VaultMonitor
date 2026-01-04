require('dotenv').config();
const path = require('path');
const { initDB } = require('./src/data/db');
const ConfigLoader = require('./src/utils/config_loader');
const ProbeFactory = require('./src/engine/factory');
const AlertManager = require('./src/engine/alert_manager');
const ProbeRunner = require('./src/engine/runner');
const TelegramChannel = require('./src/channels/telegram');

async function main() {
    // 1. Init DB
    initDB();

    // 2. Load Config
    // config.yaml is expected in config/ or root
    const configPath = process.argv[2] || path.join(__dirname, 'config', 'config.yaml');
    console.log(`[Service] Loading config from ${configPath}`);
    const config = ConfigLoader.load(configPath);

    // 3. Setup Channels
    const alertManager = new AlertManager();

    // Auto-register Telegram if env vars exist
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const telegram = new TelegramChannel({
            token: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID
        });
        alertManager.registerChannel(telegram);
        console.log('[Service] Telegram channel registered.');
    } else {
        console.warn('[Service] No Telegram credentials found in ENV. Alerts will only be logged.');
    }

    // 4. Start Engine
    const factory = new ProbeFactory();
    const runner = new ProbeRunner(factory, alertManager);

    await runner.start(config);

    // Handle shutdown
    process.on('SIGINT', () => {
        runner.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('[Fatal] Service crashed:', err);
    process.exit(1);
});
