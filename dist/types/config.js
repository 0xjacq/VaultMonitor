"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigSchema = exports.RuleConfigSchema = exports.ProbeConfigSchema = exports.HttpProbeConfigSchema = exports.EvmCallConfigSchema = exports.BaseProbeConfigSchema = void 0;
/**
 * Config Types with Zod Validation
 */
const zod_1 = require("zod");
// Base probe config schema
exports.BaseProbeConfigSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: zod_1.z.enum(['evm_call', 'evm_log', 'http']),
    enabled: zod_1.z.boolean(),
    interval: zod_1.z.number().positive(),
    timeout: zod_1.z.number().positive().optional().default(15000),
});
// EVM Call probe config
exports.EvmCallConfigSchema = exports.BaseProbeConfigSchema.extend({
    type: zod_1.z.literal('evm_call'),
    rpcUrl: zod_1.z.string().url(),
    calls: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        target: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Ethereum address
        abi: zod_1.z.array(zod_1.z.any()),
        method: zod_1.z.string(),
        args: zod_1.z.array(zod_1.z.any()).optional(),
        decimals: zod_1.z.number().int().min(0).max(18).optional(),
    })),
});
// HTTP probe config with simplified extract
exports.HttpProbeConfigSchema = exports.BaseProbeConfigSchema.extend({
    type: zod_1.z.literal('http'),
    url: zod_1.z.string().url(),
    method: zod_1.z.enum(['GET', 'POST']).optional().default('GET'),
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    body: zod_1.z.any().optional(),
    extract: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(), // key -> JSONPath or dot-notation
});
// Discriminated union for all probe types
exports.ProbeConfigSchema = zod_1.z.discriminatedUnion('type', [
    exports.EvmCallConfigSchema,
    exports.HttpProbeConfigSchema,
]);
// Rule config schema
exports.RuleConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(['threshold', 'change']),
    fact: zod_1.z.string(),
    threshold: zod_1.z.number().optional(),
    operator: zod_1.z.enum(['>', '>=', '<', '<=']).optional(),
    severity: zod_1.z.enum(['info', 'warning', 'critical']).optional(),
    title: zod_1.z.string().optional(),
    messageTemplate: zod_1.z.string().optional(),
});
// App config schema
exports.AppConfigSchema = zod_1.z.object({
    probes: zod_1.z.array(exports.ProbeConfigSchema),
});
//# sourceMappingURL=config.js.map