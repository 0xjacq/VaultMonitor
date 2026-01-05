"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = void 0;
const state_manager_1 = require("./state-manager");
class AlertManager {
    channels = [];
    stateManager;
    constructor(stateManager = state_manager_1.StateManager) {
        this.stateManager = stateManager;
    }
    registerChannel(channel) {
        this.channels.push(channel);
    }
    async processAlerts(alerts, probeState) {
        console.log(`[AlertManager] 📨 Processing ${alerts.length} alert(s)...`);
        for (const alert of alerts) {
            console.log(`[AlertManager] Processing alert: ${alert.id}`);
            console.log(`[AlertManager]   Title: ${alert.title}`);
            console.log(`[AlertManager]   Severity: ${alert.severity}`);
            console.log(`[AlertManager]   Message: ${alert.message}`);
            // Step 1: Check mute
            if (this.isMuted(probeState)) {
                console.log(`[AlertManager]   ⏸️  SUPPRESSED (probe muted)`);
                continue;
            }
            // Step 2: Dedup with TTL
            if (this.isDuplicate(alert)) {
                console.log(`[AlertManager]   ⏸️  SUPPRESSED (duplicate)`);
                continue;
            }
            // Step 3: Cooldown check
            if (this.isInCooldown(alert)) {
                console.log(`[AlertManager]   ⏸️  SUPPRESSED (cooldown)`);
                continue;
            }
            // Step 4: Route to channels
            console.log(`[AlertManager]   ✉️  Routing to ${this.channels.length} channel(s)...`);
            await this.routeToChannels(alert);
            // Step 5: Record alert + cooldown
            this.recordAlert(alert);
            console.log(`[AlertManager]   ✅ Alert processed and recorded`);
        }
    }
    isMuted(state) {
        const mutedUntil = state.probe?.muted_until;
        return mutedUntil !== undefined && Date.now() < mutedUntil;
    }
    isDuplicate(alert) {
        return this.stateManager.isAlertSent(alert.id);
    }
    isInCooldown(alert) {
        const key = `${alert.probeId}:${alert.ruleId}`;
        const cooldownMs = 15 * 60 * 1000; // 15min default
        return this.stateManager.isInCooldown(key, cooldownMs);
    }
    async routeToChannels(alert) {
        const tasks = this.channels.map(channel => channel.send(alert).catch(err => {
            console.error(`[AlertManager] Failed to send to ${channel.name}:`, err);
        }));
        await Promise.all(tasks);
    }
    recordAlert(alert) {
        this.stateManager.recordAlert(alert.id, alert.probeId, alert.ruleId);
        this.stateManager.recordCooldown(`${alert.probeId}:${alert.ruleId}`);
    }
}
exports.AlertManager = AlertManager;
//# sourceMappingURL=alert-manager.js.map