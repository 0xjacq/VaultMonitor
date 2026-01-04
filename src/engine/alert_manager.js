const StateManager = require('./state_manager');
const { Severity } = require('../core/types');

class AlertManager {
    constructor() {
        this.channels = [];
    }

    registerChannel(channel) {
        this.channels.push(channel);
    }

    async processAlerts(alerts) {
        for (const alert of alerts) {
            await this.handleAlert(alert);
        }
    }

    async handleAlert(alert) {
        const { id, probeId, ruleId } = alert;

        // 1. Deduplication
        // Check if this specific alert ID has already been sent
        if (StateManager.isAlertSent(id)) {
            console.log(`[AlertManager] Duplicate alert suppressed: ${id}`);
            return;
        }

        // 2. Cooldown (Optional - could be implemented here or in Rule)
        // For now, relies on unique alert ID generation strategies (e.g. ID includes timestamp bucket)

        // 3. Routing & Sending
        // Filter channels based on severity or config (MVP: Send to all registered)
        console.log(`[AlertManager] Processing alert: ${alert.title}`);

        const tasks = this.channels.map(channel => channel.send(alert).catch(err => {
            console.error(`[AlertManager] Failed to send to ${channel.name}:`, err.message);
        }));

        await Promise.all(tasks);

        // 4. Mark as Sent
        StateManager.recordAlert(id, probeId, ruleId);
    }
}

module.exports = AlertManager;
