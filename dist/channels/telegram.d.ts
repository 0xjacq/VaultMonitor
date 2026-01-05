/**
 * Telegram Channel (TypeScript)
 */
import { Alert } from '../types/domain';
import { NotificationChannel } from '../engine/alert-manager';
export declare class TelegramChannel implements NotificationChannel {
    readonly name = "telegram";
    private client;
    private chatId;
    constructor(config: {
        token: string;
        chatId: string;
    });
    send(alert: Alert): Promise<void>;
    private format;
    private getSeverityIcon;
}
//# sourceMappingURL=telegram.d.ts.map