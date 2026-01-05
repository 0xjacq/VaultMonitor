"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeRunner = void 0;
const state_manager_1 = require("./state-manager");
const domain_1 = require("../types/domain");
const fact_helpers_1 = require("../utils/fact-helpers");
class ProbeRunner {
    probeFactory;
    ruleFactory;
    alertManager;
    stateManager;
    probeInstances = new Map();
    rulesByProbe = new Map();
    runningProbes = new Map();
    activeLocks = new Map(); // probeId -> lock timestamp
    config; // Expose config for WebServer
    constructor(probeFactory, ruleFactory, alertManager, stateManager = state_manager_1.StateManager) {
        this.probeFactory = probeFactory;
        this.ruleFactory = ruleFactory;
        this.alertManager = alertManager;
        this.stateManager = stateManager;
    }
    async start(config) {
        console.log('[Runner] Starting engine...');
        this.config = config; // Store config for WebServer access
        // Initialize probes and rules
        for (const probeConfig of config.probes) {
            if (!probeConfig.enabled)
                continue;
            const probe = this.probeFactory.create(probeConfig);
            this.probeInstances.set(probeConfig.id, probe);
            // Create rules for this probe (assuming rules are in probe config)
            // For now, we'll handle this via web UI or separate config
            this.rulesByProbe.set(probeConfig.id, []);
            this.scheduleProbe(probeConfig);
        }
    }
    scheduleProbe(config) {
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
    async runProbeWithTimeout(probeId, timeout) {
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
                        severity: domain_1.Severity.CRITICAL,
                        title: 'Probe Stuck',
                        message: `Probe ${probeId} exceeded ${timeout * 2}ms, force unlocked`,
                        timestamp: Date.now()
                    }], { probe: {}, rule: {} });
            }
            else {
                console.warn(`[Runner] Probe ${probeId} still running (${lockDuration}ms), skipping`);
                return;
            }
        }
        const probe = this.probeInstances.get(probeId);
        if (!probe)
            return;
        this.activeLocks.set(probeId, Date.now()); // ACQUIRE LOCK with timestamp
        const startedAt = Date.now();
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Probe timeout')), timeout));
            const state = this.stateManager.getProbeState(probeId);
            // Collect facts
            const factsPromise = probe.collect(state);
            const facts = await Promise.race([factsPromise, timeoutPromise]);
            // Validate fact keys (optional warning)
            (0, fact_helpers_1.validateFactKeys)(facts);
            // Evaluate rules
            const rules = this.rulesByProbe.get(probeId) || [];
            const alerts = [];
            const context = {
                probeId,
                timestamp: Date.now(),
                state
            };
            for (const rule of rules) {
                try {
                    const result = await rule.evaluate(facts, context);
                    if (result) {
                        if (Array.isArray(result))
                            alerts.push(...result);
                        else
                            alerts.push(result);
                    }
                }
                catch (err) {
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
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Runner:${probeId}] Error:`, errorMsg);
            this.stateManager.recordRun(probeId, 'error', durationMs, errorMsg);
        }
        finally {
            this.activeLocks.delete(probeId); // RELEASE LOCK
        }
    }
    // Control methods
    async runProbeById(id) {
        const probe = this.probeInstances.get(id);
        if (!probe)
            throw new Error(`Probe ${id} not found`);
        await this.runProbeWithTimeout(id, 15000);
    }
    enableProbe(id) {
        console.log(`[Runner] Enabling probe ${id}`);
        // Implementation depends on having config reference
        // For now, just log
    }
    disableProbe(id) {
        console.log(`[Runner] Disabling probe ${id}`);
        const handle = this.runningProbes.get(id);
        if (handle)
            clearInterval(handle);
        this.runningProbes.delete(id);
    }
    async muteProbe(id, durationMinutes) {
        const state = this.stateManager.getProbeState(id);
        const muteUntil = Date.now() + (durationMinutes * 60 * 1000);
        state.probe = { ...state.probe, muted_until: muteUntil };
        this.stateManager.saveProbeState(id, state);
        console.log(`[Runner] Probe ${id} muted for ${durationMinutes}m`);
    }
    async unmuteProbe(id) {
        const state = this.stateManager.getProbeState(id);
        if (state.probe?.muted_until) {
            delete state.probe.muted_until;
            this.stateManager.saveProbeState(id, state);
            console.log(`[Runner] Probe ${id} unmuted`);
        }
    }
    addRuleToProbe(probeId, rule) {
        const rules = this.rulesByProbe.get(probeId) || [];
        rules.push(rule);
        this.rulesByProbe.set(probeId, rules);
    }
}
exports.ProbeRunner = ProbeRunner;
//# sourceMappingURL=runner.js.map