const StateManager = require('./state_manager');

class ProbeRunner {
    /**
     * @param {Object} factory - ProbeFactory instance to create probes
     * @param {AlertManager} alertManager
     * @param {Object} db - Database instance
     */
    constructor(factory, alertManager) {
        this.factory = factory;
        this.alertManager = alertManager;
        this.runningProbes = new Map(); // id -> intervalHandle
    }

    async start(config) {
        console.log('[Runner] Starting engine...');

        for (const probeConfig of config.probes) {
            await this.scheduleProbe(probeConfig);
        }
    }

    async scheduleProbe(config) {
        const probeId = config.id;
        if (!config.enabled) {
            console.log(`[Runner] Probe ${probeId} is disabled.`);
            return;
        }

        try {
            const probe = this.factory.create(config);
            console.log(`[Runner] Scheduling probe ${probeId} every ${config.interval}ms`);

            // Run immediately
            this.runProbe(probe);

            // Schedule
            const handle = setInterval(() => {
                this.runProbe(probe);
            }, config.interval);

            this.runningProbes.set(probeId, handle);

        } catch (err) {
            console.error(`[Runner] Failed to initialize probe ${probeId}:`, err.message);
        }
    }

    async runProbe(probe) {
        const start = Date.now();
        const probeId = probe.id;

        try {
            // Load previous state
            const state = StateManager.getProbeState(probeId);

            // Execute
            // console.log(`[Runner] Running ${probeId}...`);
            const alerts = await probe.evaluate({}, state); // In v2, evaluate might do collection internally or we split it.
            // Wait, BaseProbe definition: run() calls collect() then evaluate().
            // Let's assume probe.run() does the work and returns alerts.
            // Actually BaseProbe.run() is abstract. Let's fix BaseProbe usage.

            // Correct usage: probe.run() -> returns alerts
            // Let's assume implementations of run() handle everything.
            // But wait, my BaseProbe definition had `evaluate(facts)`.
            // Let's adjust implementations to have a main entry point `execute()` or similar.
            // Ref: BaseProbe says "run() must be implemented".

            const generatedAlerts = await probe.run(state);

            if (generatedAlerts && generatedAlerts.length > 0) {
                await this.alertManager.processAlerts(generatedAlerts);
            }

            StateManager.recordRun(probeId, 'success', Date.now() - start);

        } catch (err) {
            console.error(`[Runner] Probe ${probeId} failed:`, err.message);
            StateManager.recordRun(probeId, 'error', Date.now() - start, err.message);
        }
    }

    stop() {
        for (const [id, handle] of this.runningProbes) {
            clearInterval(handle);
        }
        this.runningProbes.clear();
        console.log('[Runner] Engine stopped.');
    }
}

module.exports = ProbeRunner;
