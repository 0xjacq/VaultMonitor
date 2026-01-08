/**
 * Platform-Based Config Types with Zod Validation
 * 
 * New configuration schema for platform-based architecture.
 * Coexists with legacy config during migration period.
 */
import { z } from 'zod';

// Platform configuration schema
export const PlatformConfigSchema = z.object({
    platform: z.string(),   // Platform ID (e.g., 'pendle', 'aave', 'evm')
    enabled: z.boolean().optional().default(true),
    config: z.record(z.string(), z.any()).optional(),  // Platform-specific configuration
});

// Rule config schema
export const RuleConfigSchema = z.object({
    id: z.string(),
    type: z.enum(['threshold', 'change']),
    fact: z.string(),
    threshold: z.number().optional(),
    operator: z.enum(['>', '>=', '<', '<=']).optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    title: z.string().optional(),
    messageTemplate: z.string().optional(),
});

// Platform-based probe config schema
export const PlatformProbeConfigSchema = z.object({
    id: z.string().min(1),
    platform: z.string(),              // Platform ID (e.g., 'pendle', 'aave')
    type: z.string(),                  // Probe type specific to platform
    enabled: z.boolean().optional().default(true),
    interval: z.number().positive(),
    timeout: z.number().positive().optional().default(15000),
    config: z.record(z.string(), z.any()),  // Probe-specific configuration
    rules: z.array(RuleConfigSchema).optional(),
});

// App config schema with platforms support
export const PlatformAppConfigSchema = z.object({
    platforms: z.array(PlatformConfigSchema).optional(),
    probes: z.array(PlatformProbeConfigSchema),
});

// Type inference from schemas
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export type PlatformProbeConfig = z.infer<typeof PlatformProbeConfigSchema>;
export type PlatformAppConfig = z.infer<typeof PlatformAppConfigSchema>;
export type PlatformRuleConfig = z.infer<typeof RuleConfigSchema>;
