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
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.client.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
                return;
            } catch (err) {
                console.error(`[Telegram] Send failed (attempt ${attempt}/${maxAttempts}):`, err);
                if (attempt === maxAttempts) {
                    throw err;
                }
                await this.sleep(1000 * Math.pow(2, attempt - 1));
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private format(alert: Alert): string {
        const icon = this.getSeverityIcon(alert.severity);
        let msg = `${icon} *${this.escapeMarkdown(alert.title)}* ${icon}\n\n`;
        msg += `${this.escapeMarkdown(alert.message)}\n`;

        if (alert.entities) {
            for (const [key, val] of Object.entries(alert.entities)) {
                msg += `• *${this.escapeMarkdown(key)}*: ${this.escapeMarkdown(String(val))}\n`;
            }
        }

        if (alert.links && alert.links.length > 0) {
            msg += `\n`;
            alert.links.forEach(link => {
                msg += `🔗 [${this.escapeMarkdown(link.label)}](${link.url})\n`;
            });
        }

        msg += `\n_${new Date(alert.timestamp).toISOString()}_`;

        if (msg.length > 4000) {
            msg = msg.slice(0, 4000) + '\n\n... _(truncated)_';
        }

        return msg;
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/([*_`\[])/g, '\\$1');
    }

    private getSeverityIcon(severity: Severity): string {
        switch (severity) {
            case Severity.CRITICAL: return '🚨';
            case Severity.WARNING: return '⚠️';
            default: return 'ℹ️';
        }
    }
}
