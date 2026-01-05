import { ProbeState } from '../types/domain';
export declare class StateManager {
    /**
     * Get probe state with namespaced structure
     */
    static getProbeState(probeId: string): ProbeState;
    /**
     * Save probe state (namespaced)
     */
    static saveProbeState(probeId: string, state: ProbeState): void;
    /**
     * Check if alert has been sent (with optional TTL)
     */
    static isAlertSent(alertId: string, ttlMs?: number): boolean;
    /**
     * Record sent alert
     */
    static recordAlert(alertId: string, probeId: string, ruleId: string): void;
    /**
     * Check if probe+rule combination is in cooldown
     */
    static isInCooldown(key: string, intervalMs: number): boolean;
    /**
     * Record cooldown for probe+rule
     */
    static recordCooldown(key: string): void;
    /**
     * Record probe run result
     */
    static recordRun(probeId: string, status: string, durationMs: number, errorMsg?: string): void;
}
//# sourceMappingURL=state-manager.d.ts.map