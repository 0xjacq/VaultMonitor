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
            console.log(`[Runner] Processing probe: ${probeConfig.id} (enabled: ${probeConfig.enabled})`);
            if (!probeConfig.enabled) {
                console.log(`[Runner] Skipping disabled probe: ${probeConfig.id}`);
                continue;
            }
            const probe = this.probeFactory.create(probeConfig);
            this.probeInstances.set(probeConfig.id, probe);
            // Load rules from config
            const rules = [];
            if (probeConfig.rules && Array.isArray(probeConfig.rules)) {
                console.log(`[Runner] Loading ${probeConfig.rules.length} rules for probe ${probeConfig.id}`);
                for (const ruleConfig of probeConfig.rules) {
                    try {
                        const rule = this.ruleFactory.create(ruleConfig);
                        rules.push(rule);
                        console.log(`[Runner]   ✓ Loaded rule: ${ruleConfig.id} (type: ${ruleConfig.type})`);
                    }
                    catch (err) {
                        console.error(`[Runner]   ✗ Failed to load rule ${ruleConfig.id}:`, err);
                    }
                }
            }
            else {
                console.log(`[Runner] No rules defined for probe ${probeConfig.id}`);
            }
            this.rulesByProbe.set(probeConfig.id, rules);
            this.scheduleProbe(probeConfig);
        }
        console.log(`[Runner] Engine started with ${this.probeInstances.size} active probes`);
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
            console.log(`[Runner:${probeId}] 📊 Collecting facts...`);
            const factsPromise = probe.collect(state);
            const facts = await Promise.race([factsPromise, timeoutPromise]);
            console.log(`[Runner:${probeId}] ✓ Facts collected:`, JSON.stringify(facts, (key, value) => typeof value === 'bigint' ? value.toString() : value));
            // Validate fact keys (optional warning)
            (0, fact_helpers_1.validateFactKeys)(facts);
            // Evaluate rules
            const rules = this.rulesByProbe.get(probeId) || [];
            console.log(`[Runner:${probeId}] 🔍 Evaluating ${rules.length} rules...`);
            const alerts = [];
            const context = {
                probeId,
                timestamp: Date.now(),
                state
            };
            for (const rule of rules) {
                try {
                    console.log(`[Runner:${probeId}]   Evaluating rule: ${rule.id}`);
                    const result = await rule.evaluate(facts, context);
                    if (result) {
                        const resultArray = Array.isArray(result) ? result : [result];
                        alerts.push(...resultArray);
                        console.log(`[Runner:${probeId}]   🚨 Rule ${rule.id} TRIGGERED! Alerts: ${resultArray.length}`);
                    }
                    else {
                        console.log(`[Runner:${probeId}]   ✓ Rule ${rule.id} passed (no alert)`);
                    }
                }
                catch (err) {
                    console.error(`[Runner:${probeId}]   ✗ Rule ${rule.id} failed:`, err);
                }
            }
            // Process alerts through AlertManager pipeline
            if (alerts.length > 0) {
                console.log(`[Runner:${probeId}] 📬 Processing ${alerts.length} alerts through AlertManager...`);
                await this.alertManager.processAlerts(alerts, state);
            }
            else {
                console.log(`[Runner:${probeId}] ✓ No alerts to process`);
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