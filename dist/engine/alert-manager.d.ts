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
export declare class AlertManager {
    private channels;
    private readonly stateManager;
    constructor(stateManager?: typeof StateManager);
    registerChannel(channel: NotificationChannel): void;
    processAlerts(alerts: Alert[], probeState: ProbeState): Promise<void>;
    private isMuted;
    private isDuplicate;
    private isInCooldown;
    private routeToChannels;
    private recordAlert;
}
//# sourceMappingURL=alert-manager.d.ts.map