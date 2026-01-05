/**
 * Probe Runner with Lock Pattern and Watchdog (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { BaseRule } from '../core/base-rule';
import { StateManager } from './state-manager';
import { AlertManager } from './alert-manager';
import { ProbeFactory } from './probe-factory';
import { RuleFactory } from './rule-factory';
import { AppConfig, ProbeConfig, RuleConfig } from '../types/config';
import { Alert, ProbeContext, Severity } from '../types/domain';
import { validateFactKeys } from '../utils/fact-helpers';

export class ProbeRunner {
    private probeInstances: Map<string, BaseProbe> = new Map();
    private rulesByProbe: Map<string, BaseRule[]> = new Map();
    private runningProbes: Map<string, NodeJS.Timeout> = new Map();
    private activeLocks: Map<string, number> = new Map(); // probeId -> lock timestamp
    public config?: AppConfig; // Expose config for WebServer

    constructor(
        private readonly probeFactory: ProbeFactory,
        private readonly ruleFactory: RuleFactory,
        private readonly alertManager: AlertManager,
        private readonly stateManager: typeof StateManager = StateManager
    ) { }

    async start(config: AppConfig): Promise<void> {
        console.log('[Runner] Starting engine...');
        this.config = config; // Store config for WebServer access

        // Initialize probes and rules
        for (const probeConfig of config.probes) {
            if (!probeConfig.enabled) continue;

            const probe = this.probeFactory.create(probeConfig);
            this.probeInstances.set(probeConfig.id, probe);

            // Create rules for this probe (assuming rules are in probe config)
            // For now, we'll handle this via web UI or separate config
            this.rulesByProbe.set(probeConfig.id, []);

            this.scheduleProbe(probeConfig);
        }
    }

    private scheduleProbe(config: ProbeConfig): void {
        const intervalMs = config.interval * 1000;
        const timeout = config.timeout || 15000;

        console.log(`[Runner] Scheduling probe ${config.id} every ${config.interval}s`);

        const handle = setInterval(async () => {
            await this.runProbeWithTimeout(config.id, timeout);
        }, intervalMs);

        this.runningProbes.set(config.id, handle);

        // Run immediately
        setImmediate(() => this.runProbeWithTimeout(config.id, timeout));
    }

    private async runProbeWithTimeout(probeId: string, timeout: number): Promise<void> {
        // Check lock with watchdog
        const lockTime = this.activeLocks.get(probeId);
        if (lockTime) {
            const lockDuration = Date.now() - lockTime;
            if (lockDuration > timeout * 2) {
                // WATCHDOG: Force unlock if stuck
                console.error(`[Runner] Probe ${probeId} stuck for ${lockDuration}ms, force unlocking`);
                this.activeLocks.delete(probeId);

                // Send alert about stuck probe
                await this.alertManager.processAlerts([{
                    id: `${probeId}:system:stuck`,
                    probeId,
                    ruleId: 'system',
                    severity: Severity.CRITICAL,
                    title: 'Probe Stuck',
                    message: `Probe ${probeId} exceeded ${timeout * 2}ms, force unlocked`,
                    timestamp: Date.now()
                }], { probe: {}, rule: {} });
            } else {
                console.warn(`[Runner] Probe ${probeId} still running (${lockDuration}ms), skipping`);
                return;
            }
        }

        const probe = this.probeInstances.get(probeId);
        if (!probe) return;

        this.activeLocks.set(probeId, Date.now()); // ACQUIRE LOCK with timestamp
        const startedAt = Date.now();

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Probe timeout')), timeout)
            );

            const state = this.stateManager.getProbeState(probeId);

            // Collect facts
            const factsPromise = probe.collect(state);
            const facts = await Promise.race([factsPromise, timeoutPromise]);

            // Validate fact keys (optional warning)
            validateFactKeys(facts);

            // Evaluate rules
            const rules = this.rulesByProbe.get(probeId) || [];
            const alerts: Alert[] = [];

            const context: ProbeContext = {
                probeId,
                timestamp: Date.now(),
                state
            };

            for (const rule of rules) {
                try {
                    const result = await rule.evaluate(facts, context);
                    if (result) {
                        if (Array.isArray(result)) alerts.push(...result);
                        else alerts.push(result);
                    }
                } catch (err) {
                    console.error(`[Runner:${probeId}] Rule ${rule.id} failed:`, err);
                }
            }

            // Process alerts through AlertManager pipeline
            if (alerts.length > 0) {
                await this.alertManager.processAlerts(alerts, state);
            }

            // Save updated state
            this.stateManager.saveProbeState(probeId, state);

            // Record successful run
            const durationMs = Date.now() - startedAt;
            this.stateManager.recordRun(probeId, 'success', durationMs);

        } catch (err) {
            const durationMs = Date.now() - startedAt;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Runner:${probeId}] Error:`, errorMsg);
            this.stateManager.recordRun(probeId, 'error', durationMs, errorMsg);
        } finally {
            this.activeLocks.delete(probeId); // RELEASE LOCK
        }
    }

    // Control methods
    async runProbeById(id: string): Promise<void> {
        const probe = this.probeInstances.get(id);
        if (!probe) throw new Error(`Probe ${id} not found`);
        await this.runProbeWithTimeout(id, 15000);
    }

    enableProbe(id: string): void {
        console.log(`[Runner] Enabling probe ${id}`);
        // Implementation depends on having config reference
        // For now, just log
    }

    disableProbe(id: string): void {
        console.log(`[Runner] Disabling probe ${id}`);
        const handle = this.runningProbes.get(id);
        if (handle) clearInterval(handle);
        this.runningProbes.delete(id);
    }

    async muteProbe(id: string, durationMinutes: number): Promise<void> {
        const state = this.stateManager.getProbeState(id);
        const muteUntil = Date.now() + (durationMinutes * 60 * 1000);
        state.probe = { ...state.probe, muted_until: muteUntil };
        this.stateManager.saveProbeState(id, state);
        console.log(`[Runner] Probe ${id} muted for ${durationMinutes}m`);
    }

    async unmuteProbe(id: string): Promise<void> {
        const state = this.stateManager.getProbeState(id);
        if (state.probe?.muted_until) {
            delete (state.probe as any).muted_until;
            this.stateManager.saveProbeState(id, state);
            console.log(`[Runner] Probe ${id} unmuted`);
        }
    }

    addRuleToProbe(probeId: string, rule: BaseRule): void {
        const rules = this.rulesByProbe.get(probeId) || [];
        rules.push(rule);
        this.rulesByProbe.set(probeId, rules);
    }
}
