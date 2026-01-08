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

/**
 * Fact namespace - now platform-based
 * 
 * Each platform generates facts with its own namespace:
 * - evm.*: EVM platform facts (e.g., evm.block, ev.totalSupply)
 * - http.*: HTTP platform facts (e.g., http.response, http.status)
 * - pendle.*: Pendle platform facts (e.g., pendle.impliedApy, pendle.totalLiquidity)
 * - aave.*: Aave platform facts (e.g., aave.healthFactor, aave.riskLevel)
 * - polymarket.*: Polymarket platform facts (e.g., polymarket.probability, polymarket.volume24h)
 * 
 * Generic string type allows any platform to define its own facts without type changes.
 */
export type FactKey = string;

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
