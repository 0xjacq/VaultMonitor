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
        this.config = config;

        for (const probeConfig of config.probes) {
            await this.scheduleProbe(probeConfig);
        }
    }

    async runProbeById(id) {
        const probeConfig = this.config.probes.find(p => p.id === id);
        if (!probeConfig) throw new Error(`Probe ${id} not found`);
        const probe = this.factory.create(probeConfig);
        await this.runProbe(probe);
    }

    enableProbe(id) {
        const probeConfig = this.config.probes.find(p => p.id === id);
        if (probeConfig) {
            probeConfig.enabled = true;
            this.scheduleProbe(probeConfig); // Re-schedule
            console.log(`[Runner] Probe ${id} enabled.`);
        }
    }

    disableProbe(id) {
        const probeConfig = this.config.probes.find(p => p.id === id);
        if (probeConfig) {
            probeConfig.enabled = false;
            // Clear interval
            const handle = this.runningProbes.get(id);
            if (handle) clearInterval(handle);
            this.runningProbes.delete(id);
            console.log(`[Runner] Probe ${id} disabled.`);
        }
    }

    async muteProbe(id, durationMinutes) {
        const state = StateManager.getProbeState(id) || {};
        const muteUntil = Date.now() + (durationMinutes * 60 * 1000);
        state.data = state.data || {};
        state.data.muted_until = muteUntil;
        StateManager.saveProbeState(id, state);
        console.log(`[Runner] Probe ${id} muted for ${durationMinutes}m`);
    }

    async scheduleProbe(config) {
        // ... (existing code, ensure it respects enabled flag which it does)
        const probeId = config.id;
        // Clear existing if any (to avoid duplicates when re-enabling)
        if (this.runningProbes.has(probeId)) {
            clearInterval(this.runningProbes.get(probeId));
            this.runningProbes.delete(probeId);
        }

        if (!config.enabled) {
            console.log(`[Runner] Probe ${probeId} is disabled.`);
            return;
        }

        try {
            const probe = this.factory.create(config);
            console.log(`[Runner] Scheduling probe ${probeId} every ${config.interval}ms`);

            this.runProbe(probe); // Run once immediately

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
            const state = StateManager.getProbeState(probeId) || { data: {} };

            // Check Mute
            if (state.data && state.data.muted_until && Date.now() < state.data.muted_until) {
                console.log(`[Runner] Probe ${probeId} is muted. Skipping logic.`);
                // We still record the run as success but skipped logic? Or just skip?
                // Let's record it as generic success with 0 duration to show liveness
                StateManager.recordRun(probeId, 'success', 0, 'Muted');
                return;
            }

            const generatedAlerts = await probe.run(state);

            // SAVE STATE! This was missing
            StateManager.saveProbeState(probeId, state);

            if (generatedAlerts && generatedAlerts.length > 0) {
                await this.alertManager.processAlerts(generatedAlerts);
            } else {
                console.log(`[Runner] Probe ${probeId} run complete (No alerts)`);
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
