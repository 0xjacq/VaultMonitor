/**
 * Config Types with Zod Validation
 */
import { z } from 'zod';
export declare const BaseProbeConfigSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        evm_call: "evm_call";
        evm_log: "evm_log";
        http: "http";
    }>;
    enabled: z.ZodBoolean;
    interval: z.ZodNumber;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const EvmCallConfigSchema: z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodBoolean;
    interval: z.ZodNumber;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    type: z.ZodLiteral<"evm_call">;
    rpcUrl: z.ZodString;
    calls: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        target: z.ZodString;
        abi: z.ZodArray<z.ZodAny>;
        method: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodAny>>;
        decimals: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const HttpProbeConfigSchema: z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodBoolean;
    interval: z.ZodNumber;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    method: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        GET: "GET";
        POST: "POST";
    }>>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodAny>;
    extract: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const ProbeConfigSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodBoolean;
    interval: z.ZodNumber;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    type: z.ZodLiteral<"evm_call">;
    rpcUrl: z.ZodString;
    calls: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        target: z.ZodString;
        abi: z.ZodArray<z.ZodAny>;
        method: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodAny>>;
        decimals: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodBoolean;
    interval: z.ZodNumber;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    method: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        GET: "GET";
        POST: "POST";
    }>>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodAny>;
    extract: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>], "type">;
export declare const RuleConfigSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        threshold: "threshold";
        change: "change";
    }>;
    fact: z.ZodString;
    threshold: z.ZodOptional<z.ZodNumber>;
    operator: z.ZodOptional<z.ZodEnum<{
        ">": ">";
        ">=": ">=";
        "<": "<";
        "<=": "<=";
    }>>;
    severity: z.ZodOptional<z.ZodEnum<{
        info: "info";
        warning: "warning";
        critical: "critical";
    }>>;
    title: z.ZodOptional<z.ZodString>;
    messageTemplate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AppConfigSchema: z.ZodObject<{
    probes: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodLiteral<"evm_call">;
        rpcUrl: z.ZodString;
        calls: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            target: z.ZodString;
            abi: z.ZodArray<z.ZodAny>;
            method: z.ZodString;
            args: z.ZodOptional<z.ZodArray<z.ZodAny>>;
            decimals: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        method: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            GET: "GET";
            POST: "POST";
        }>>>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        body: z.ZodOptional<z.ZodAny>;
        extract: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>;
export type BaseProbeConfig = z.infer<typeof BaseProbeConfigSchema>;
export type EvmCallConfig = z.infer<typeof EvmCallConfigSchema>;
export type HttpProbeConfig = z.infer<typeof HttpProbeConfigSchema>;
export type ProbeConfig = z.infer<typeof ProbeConfigSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
//# sourceMappingURL=config.d.ts.map