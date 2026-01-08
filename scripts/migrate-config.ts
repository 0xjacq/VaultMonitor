#!/usr/bin/env node
/**
 * Configuration Migration Script
 * 
 * Migrates legacy config.yaml to new platform-based format.
 * 
 * Usage:
 *   npm run migrate-config -- <old-config.yaml> <new-config.yaml>
 *   node scripts/migrate-config.js config/config.yaml config/config-new.yaml
 */

import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';

interface LegacyProbe {
    id: string;
    type: 'evm_call' | 'http';
    enabled: boolean;
    interval: number;
    timeout?: number;
    rpcUrl?: string;
    calls?: any[];
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    extract?: Record<string, string>;
    rules?: any[];
}

interface NewProbe {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: any;
    rules?: any[];
}

function migrateProbe(legacy: LegacyProbe): NewProbe {
    if (legacy.type === 'evm_call') {
        return {
            id: legacy.id,
            platform: 'evm',
            type: 'contract_call',
            enabled: legacy.enabled,
            interval: legacy.interval,
            timeout: legacy.timeout || 15000,
            config: {
                rpcUrl: legacy.rpcUrl,
                calls: legacy.calls
            },
            rules: legacy.rules?.map(r => ({
                ...r,
                // Update fact references from metric.* to evm.*
                fact: r.fact.replace(/^metric\./, 'evm.')
            }))
        };
    } else if (legacy.type === 'http') {
        return {
            id: legacy.id,
            platform: 'http',
            type: 'generic_api',
            enabled: legacy.enabled,
            interval: legacy.interval,
            timeout: legacy.timeout || 15000,
            config: {
                url: legacy.url,
                method: legacy.method,
                headers: legacy.headers,
                body: legacy.body,
                extract: legacy.extract
            },
            rules: legacy.rules
        };
    }

    throw new Error(`Unknown probe type: ${legacy.type}`);
}

function migrateConfig(inputPath: string, outputPath: string): void {
    console.log(`📖 Reading legacy config: ${inputPath}`);

    const legacyYaml = fs.readFileSync(inputPath, 'utf8');
    const legacyConfig = yaml.parse(legacyYaml);

    if (!legacyConfig.probes || !Array.isArray(legacyConfig.probes)) {
        throw new Error('Invalid legacy config: missing probes array');
    }

    console.log(`✓ Found ${legacyConfig.probes.length} probes to migrate`);

    // Migrate probes
    const newProbes: NewProbe[] = [];
    for (const probe of legacyConfig.probes) {
        try {
            const migrated = migrateProbe(probe);
            newProbes.push(migrated);
            console.log(`  ✓ Migrated ${probe.id} (${probe.type} → ${migrated.platform}.${migrated.type})`);
        } catch (err) {
            console.error(`  ✗ Failed to migrate ${probe.id}:`, err);
            throw err;
        }
    }

    // Create new config with platforms
    const newConfig = {
        platforms: [
            {
                platform: 'evm',
                enabled: true,
                config: {
                    circuitBreaker: {
                        failureThreshold: 5,
                        resetTimeout: 60000,
                        halfOpenMaxAttempts: 3
                    }
                }
            },
            {
                platform: 'http',
                enabled: true,
                config: {
                    circuitBreaker: {
                        failureThreshold: 5,
                        resetTimeout: 60000,
                        halfOpenMaxAttempts: 3
                    }
                }
            }
        ],
        probes: newProbes
    };

    // Write new config
    console.log(`\n💾 Writing new config: ${outputPath}`);
    const newYaml = yaml.stringify(newConfig);
    fs.writeFileSync(outputPath, newYaml, 'utf8');

    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated ${newProbes.length} probes`);
    console.log(`   Old config: ${inputPath}`);
    console.log(`   New config: ${outputPath}`);
    console.log(`\n⚠️  Review the new configuration before using it.`);
    console.log(`   Update fact references in your alerting rules if needed.`);
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length !== 2) {
    console.error('Usage: migrate-config <input-config.yaml> <output-config.yaml>');
    console.error('Example: node scripts/migrate-config.js config/config.yaml config/config-new.yaml');
    process.exit(1);
}

const [inputPath, outputPath] = args;

try {
    migrateConfig(inputPath, outputPath);
} catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
}
