require('dotenv').config();
const path = require('path');
const ConfigLoader = require('./src/utils/config_loader');
const ProbeFactory = require('./src/engine/factory');
const AlertManager = require('./src/engine/alert_manager');
const TelegramChannel = require('./src/channels/telegram');
const StateManager = require('./src/engine/state_manager');
const { initDB } = require('./src/data/db');

async function testFullFlow() {
    console.log('🚀 Starting End-to-End Test...');

    // 1. Init DB (in-memory or file, doesn't matter much for test but needed)
    initDB();

    // 2. Load Config
    const configPath = path.join(__dirname, 'config', 'config.yaml');
    const config = ConfigLoader.load(configPath);

    // 3. Setup Telegram
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
        process.exit(1);
    }

    const alertManager = new AlertManager();
    const telegram = new TelegramChannel({
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    });
    alertManager.registerChannel(telegram);
    console.log('✅ Telegram Channel registered');

    // 4. PREPARE TEST PROBE
    // We take the real usd3_monitor config but HACK the threshold to 0
    // This forces an alert because Current Value > 0
    const rawProbeConfig = config.probes.find(p => p.id === 'usd3_monitor');
    if (!rawProbeConfig) throw new Error('usd3_monitor not found');

    // Clone to avoid mutating global cache if any
    const testConfig = JSON.parse(JSON.stringify(rawProbeConfig));
    testConfig.id = 'usd3_test_e2e'; // Change ID to avoid messing with real state

    // Find the rule and sabotage it
    const rule = testConfig.rules.find(r => r.id === 'cap_threshold_check');
    if (rule) {
        console.log(`\n🧪 MODIFICATION: Setting threshold to 0 to FORCE detection.`);
        rule.threshold = 0;
        // Also update message to indicate this is a TEST
        rule.title = "[TEST] USD3 Alert Verification";
    }

    // 5. Create and Run Probe
    const factory = new ProbeFactory();
    const probe = factory.create(testConfig);

    console.log('🔄 Running Probe...');
    const collectedAlerts = await probe.run({}); // Empty state

    if (collectedAlerts.length > 0) {
        console.log(`✅ Generated ${collectedAlerts.length} alerts.`);
        console.log('📤 Sending to Telegram...');

        await alertManager.processAlerts(collectedAlerts);

        console.log('\n✨ DONE! Check your Telegram.');
        console.log('If you received the message, the ENTIRE pipeline works.');
    } else {
        console.error('❌ No alerts generated. Something is wrong with the data collection.');
    }
}

testFullFlow().catch(console.error);
