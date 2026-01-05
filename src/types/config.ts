/**
 * Config Types with Zod Validation
 */
import { z } from 'zod';

// Base probe config schema
export const BaseProbeConfigSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['evm_call', 'evm_log', 'http']),
    enabled: z.boolean(),
    interval: z.number().positive(),
    timeout: z.number().positive().optional().default(15000),
});

// Rule config schema (defined before probes so it can be referenced)
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


// EVM Call probe config
export const EvmCallConfigSchema = BaseProbeConfigSchema.extend({
    type: z.literal('evm_call'),
    rpcUrl: z.string().url(),
    calls: z.array(z.object({
        name: z.string(),
        target: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Ethereum address
        abi: z.array(z.any()),
        method: z.string(),
        args: z.array(z.any()).optional(),
        decimals: z.number().int().min(0).max(18).optional(),
    })),
    rules: z.array(RuleConfigSchema).optional(),
});

// HTTP probe config with simplified extract
export const HttpProbeConfigSchema = BaseProbeConfigSchema.extend({
    type: z.literal('http'),
    url: z.string().url(),
    method: z.enum(['GET', 'POST']).optional().default('GET'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.any().optional(),
    extract: z.record(z.string(), z.string()).optional(), // key -> JSONPath or dot-notation
    rules: z.array(RuleConfigSchema).optional(),
});

// Discriminated union for all probe types
export const ProbeConfigSchema = z.discriminatedUnion('type', [
    EvmCallConfigSchema,
    HttpProbeConfigSchema,
]);

// App config schema
export const AppConfigSchema = z.object({
    probes: z.array(ProbeConfigSchema),
});

// Type inference from schemas
export type BaseProbeConfig = z.infer<typeof BaseProbeConfigSchema>;
export type EvmCallConfig = z.infer<typeof EvmCallConfigSchema>;
export type HttpProbeConfig = z.infer<typeof HttpProbeConfigSchema>;
export type ProbeConfig = z.infer<typeof ProbeConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
