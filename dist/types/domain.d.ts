/**
 * Domain Types - Core data structures
 */
export declare enum Severity {
    INFO = "info",
    WARNING = "warning",
    CRITICAL = "critical"
}
export declare enum ProbeType {
    EVM_CALL = "evm_call",
    EVM_LOG = "evm_log",
    HTTP = "http"
}
export type FactValue = number | string | boolean | bigint | null;
export type Facts = Record<string, FactValue>;
export type FactKey = `metric.${string}` | `evm.${string}` | `http.${string}`;
export interface Alert {
    id: string;
    probeId: string;
    ruleId: string;
    severity: Severity;
    title: string;
    message: string;
    timestamp: number;
    entities?: Record<string, string>;
    links?: Array<{
        label: string;
        url: string;
    }>;
}
export interface ProbeState {
    probe: Record<string, unknown>;
    rule: Record<string, Record<string, unknown>>;
}
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
//# sourceMappingURL=domain.d.ts.map