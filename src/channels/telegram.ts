/**
 * Telegram Channel (TypeScript)
 */
import { Alert, Severity } from '../types/domain';
import { NotificationChannel } from '../engine/alert-manager';
import TelegramBot from 'node-telegram-bot-api';

export class TelegramChannel implements NotificationChannel {
    public readonly name = 'telegram';
    private client: TelegramBot;
    private chatId: string;

    constructor(config: { token: string; chatId: string }) {
        if (!config.token || !config.chatId) {
            throw new Error('TelegramChannel requires token and chatId');
        }
        this.client = new TelegramBot(config.token, { polling: false });
        this.chatId = config.chatId;
    }

    async send(alert: Alert): Promise<void> {
        const message = this.format(alert);
        try {
            await this.client.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('[Telegram] Send failed:', err);
            throw err;
        }
    }

    private format(alert: Alert): string {
        const icon = this.getSeverityIcon(alert.severity);
        let msg = `${icon} *${alert.title}* ${icon}\n\n`;
        msg += `${alert.message}\n`;

        if (alert.entities) {
            for (const [key, val] of Object.entries(alert.entities)) {
                msg += `• *${key}*: ${val}\n`;
            }
        }

        if (alert.links && alert.links.length > 0) {
            msg += `\n`;
            alert.links.forEach(link => {
                msg += `🔗 [${link.label}](${link.url})\n`;
            });
        }

        msg += `\n_${new Date(alert.timestamp).toISOString()}_`;
        return msg;
    }

    private getSeverityIcon(severity: Severity): string {
        switch (severity) {
            case Severity.CRITICAL: return '🚨';
            case Severity.WARNING: return '⚠️';
            default: return 'ℹ️';
        }
    }
}
