const TelegramBot = require('node-telegram-bot-api');

class TelegramChannel {
    constructor(config) {
        this.name = 'telegram';
        if (!config.token || !config.chatId) {
            throw new Error('TelegramChannel requires token and chatId');
        }
        this.client = new TelegramBot(config.token, { polling: false });
        this.chatId = config.chatId;
    }

    async send(alert) {
        const message = this.format(alert);
        try {
            await this.client.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
            // console.log(`[Telegram] Sent: ${alert.title}`);
        } catch (err) {
            console.error('[Telegram] Send failed:', err.message);
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
            case 'critical': return '🚨';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }
}

module.exports = TelegramChannel;
