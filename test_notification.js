require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(token, { polling: false });

async function sendTest() {
    console.log('Sending test message...');
    try {
        await bot.sendMessage(chatId, "✅ Ceci est un MESSAGE DE TEST pour vérifier que votre bot fonctionne bien !");
        console.log('Test message sent successfully!');
    } catch (err) {
        console.error('Failed to send test message:', err.message);
    }
}

sendTest();
