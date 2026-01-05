/**
 * Domain Types - Core data structures
 */

export enum Severity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

export enum ProbeType {
    EVM_CALL = 'evm_call',
    EVM_LOG = 'evm_log',
    HTTP = 'http'
}

// Strict Fact types with normalized keys
export type FactValue = number | string | boolean | bigint | null;
export type Facts = Record<string, FactValue>;

// Namespaced fact keys for consistency
export type FactKey =
    | `metric.${string}`    // e.g. metric.supply_cap, metric.tvl
    | `evm.${string}`       // e.g. evm.block_number, evm.total_assets
    | `http.${string}`;     // e.g. http.response_time, http.apy

export interface Alert {
    id: string;
    probeId: string;
    ruleId: string;
    severity: Severity;
    title: string;
    message: string;
    timestamp: number;
    entities?: Record<string, string>;
    links?: Array<{ label: string; url: string }>;
}

// Namespaced state structure
export interface ProbeState {
    probe: Record<string, unknown>;
    rule: Record<string, Record<string, unknown>>;
}

// RunResult type for structured execution tracking
export interface RunResult {
    probeId: string;
    ok: boolean;
    startedAt: number;
    finishedAt: number;
    facts: Facts;
    alerts: Alert[];
    error?: string;
}

export interface ProbeContext {
    probeId: string;
    block?: number;
    timestamp: number;
    state: ProbeState;
}
