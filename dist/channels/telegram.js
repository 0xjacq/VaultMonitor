"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramChannel = void 0;
/**
 * Telegram Channel (TypeScript)
 */
const domain_1 = require("../types/domain");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
class TelegramChannel {
    name = 'telegram';
    client;
    chatId;
    constructor(config) {
        if (!config.token || !config.chatId) {
            throw new Error('TelegramChannel requires token and chatId');
        }
        this.client = new node_telegram_bot_api_1.default(config.token, { polling: false });
        this.chatId = config.chatId;
    }
    async send(alert) {
        const message = this.format(alert);
        try {
            await this.client.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        }
        catch (err) {
            console.error('[Telegram] Send failed:', err);
            throw err;
        }
    }
    format(alert) {
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
    getSeverityIcon(severity) {
        switch (severity) {
            case domain_1.Severity.CRITICAL: return '🚨';
            case domain_1.Severity.WARNING: return '⚠️';
            default: return 'ℹ️';
        }
    }
}
exports.TelegramChannel = TelegramChannel;
//# sourceMappingURL=telegram.js.map