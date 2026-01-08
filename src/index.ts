/**
 * Main Entry Point with Platform Registry
 * 
 * Updated to use platform-based architecture.
 */

import * as dotenv from 'dotenv';
import { db } from './data/db';
import { ConfigLoader } from './utils/config-loader';
import { PlatformRegistry } from './engine/platform-registry';
import { ProbeFactory } from './engine/probe-factory';
import { RuleFactory } from './engine/rule-factory';
import { ProbeRunner } from './engine/runner';
import { AlertManager } from './engine/alert-manager';
import { TelegramChannel } from './channels/telegram';
import { WebServer } from './web/server';

// Import platforms
import { EvmPlatform } from './platforms/evm';
import { HttpPlatform } from './platforms/http';
import { PendlePlatform } from './platforms/pendle';
import { AavePlatform } from './platforms/aave';
// TODO: Re-enable Polymarket platform when polymarket-websocket-client package issue is resolved
// import { PolymarketPlatform } from './platforms/polymarket';

dotenv.config();

async function main() {
    console.log('🚀 VaultMonitor starting...\n');

    // Load configuration
    const configPath = process.env.CONFIG_PATH || './config/config.yaml';
    console.log(`📝 Loading config from: ${configPath}`);
    const config = ConfigLoader.load(configPath);

    // Create and register platforms
    const platformRegistry = new PlatformRegistry();
    platformRegistry.register(new EvmPlatform());
    platformRegistry.register(new HttpPlatform());
    platformRegistry.register(new PendlePlatform());
    platformRegistry.register(new AavePlatform());
    // TODO: Re-enable when polymarket-websocket-client is fixed
    // platformRegistry.register(new PolymarketPlatform());

    // Log registered platforms
    const summary = platformRegistry.getSummary();
    console.log(`\n📦 Registered ${summary.totalPlatforms} platforms:`);
    for (const platform of summary.platforms) {
        console.log(`   - ${platform.name} (${platform.id}) v${platform.version}`);
        console.log(`     Probe types: ${platform.probeTypes.join(', ')}`);
    }

    // Initialize platforms with config
    const platformConfigs = new Map();
    if (config.platforms) {
        for (const pConfig of config.platforms) {
            platformConfigs.set(pConfig.platform, pConfig);
        }
    }
    await platformRegistry.initializeAll(platformConfigs);

    // Create factories
    const probeFactory = new ProbeFactory(platformRegistry);
    const ruleFactory = new RuleFactory();

    // Set up alert channels
    const alertManager = new AlertManager();
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        console.log('\n📱 Telegram notifications enabled');
        const telegramChannel = new TelegramChannel({
            token: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID
        });
        alertManager.registerChannel(telegramChannel);
    }

    // Start probe runner
    const runner = new ProbeRunner(probeFactory, ruleFactory, alertManager);
    await runner.start(config);

    // Start web server
    const webServer = new WebServer(runner, alertManager);
    webServer.start(parseInt(process.env.PORT || '3000'));

    console.log('\n✅ VaultMonitor running\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        runner.stop();
        await platformRegistry.destroyAll();
        await db.close();
        webServer.stop();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
