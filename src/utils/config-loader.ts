/**
 * Config Loader with Zod Validation (TypeScript)
 */
import { PlatformAppConfigSchema, PlatformAppConfig } from '../types/platform-config';
import * as yaml from 'yaml';
import * as fs from 'fs';

export class ConfigLoader {
    static load(filePath: string): PlatformAppConfig {
        const content = fs.readFileSync(filePath, 'utf8');
        const raw = yaml.parse(content);

        // Validate with Zod - fail fast on invalid config
        try {
            return PlatformAppConfigSchema.parse(raw);
        } catch (err) {
            console.error('[ConfigLoader] Invalid configuration:', err);
            throw new Error('Boot failed: Invalid config.yaml');
        }
    }
}
