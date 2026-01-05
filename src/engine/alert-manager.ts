/**
 * Alert Manager with Strict Pipeline (TypeScript)
 * Pipeline: mute → dedup → cooldown → routing → record
 */
import { Alert, ProbeState } from '../types/domain';
import { StateManager } from './state-manager';

export interface NotificationChannel {
    readonly name: string;
    send(alert: Alert): Promise<void>;
}

export class AlertManager {
    private channels: NotificationChannel[] = [];
    private readonly stateManager: typeof StateManager;

    constructor(stateManager: typeof StateManager = StateManager) {
        this.stateManager = stateManager;
    }

    registerChannel(channel: NotificationChannel): void {
        this.channels.push(channel);
    }

    async processAlerts(alerts: Alert[], probeState: ProbeState): Promise<void> {
        for (const alert of alerts) {
            // Step 1: Check mute
            if (this.isMuted(probeState)) {
                console.log(`[AlertManager] Alert ${alert.id} suppressed (probe muted)`);
                continue;
            }

            // Step 2: Dedup with TTL
            if (this.isDuplicate(alert)) {
                console.log(`[AlertManager] Alert ${alert.id} suppressed (duplicate)`);
                continue;
            }

            // Step 3: Cooldown check
            if (this.isInCooldown(alert)) {
                console.log(`[AlertManager] Alert ${alert.id} suppressed (cooldown)`);
                continue;
            }

            // Step 4: Route to channels
            await this.routeToChannels(alert);

            // Step 5: Record alert + cooldown
            this.recordAlert(alert);
        }
    }

    private isMuted(state: ProbeState): boolean {
        const mutedUntil = state.probe?.muted_until as number | undefined;
        return mutedUntil !== undefined && Date.now() < mutedUntil;
    }

    private isDuplicate(alert: Alert): boolean {
        return this.stateManager.isAlertSent(alert.id);
    }

    private isInCooldown(alert: Alert): boolean {
        const key = `${alert.probeId}:${alert.ruleId}`;
        const cooldownMs = 15 * 60 * 1000; // 15min default
        return this.stateManager.isInCooldown(key, cooldownMs);
    }

    private async routeToChannels(alert: Alert): Promise<void> {
        const tasks = this.channels.map(channel =>
            channel.send(alert).catch(err => {
                console.error(`[AlertManager] Failed to send to ${channel.name}:`, err);
            })
        );
        await Promise.all(tasks);
    }

    private recordAlert(alert: Alert): void {
        this.stateManager.recordAlert(alert.id, alert.probeId, alert.ruleId);
        this.stateManager.recordCooldown(`${alert.probeId}:${alert.ruleId}`);
    }
}
