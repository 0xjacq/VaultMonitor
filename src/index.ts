/**
 * Main Entry Point (TypeScript)
 */
import { initDB } from './data/db';
import { ConfigLoader } from './utils/config-loader';
import { StateManager } from './engine/state-manager';
import * as path from 'path';

// Initialize database
initDB();

// Load configuration
const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config', 'config.yaml');
console.log('[Main] Loading configuration from:', configPath);

try {
    const config = ConfigLoader.load(configPath);
    console.log(`[Main] Loaded ${config.probes.length} probes`);

    // For now, just validate the config loads successfully
    // Full Runner integration will come in next phase
    console.log('[Main] TypeScript migration successful - config validation passed');
    console.log('[Main] Note: Full probe execution not yet migrated to TS');

} catch (err) {
    console.error('[Main] Failed to start:', err);
    process.exit(1);
}
