require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Config
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: false });

// Mock Event (from user provided data)
const mockTx = {
    "block_hash": "0xf4911d0b6e5fc8fc2a98c3c4a7024ff4dc9f5bb0e1b07cc1a033fc525d0a316e",
    "block_number": 31754122,
    "from": {
        "hash": "0x6fECeE89e588812Da36af94142168EcFE882C792",
        "ens_domain_name": "chinpoco.eth"
    },
    "method": "withdraw",
    "timestamp": "2025-12-09T03:55:33.000000Z",
    "to": {
        "hash": "0x0000000000000000000000000000000000000000"
    },
    "token": {
        "symbol": "aInkWlUSDC",
        "decimals": "6"
    },
    "total": {
        "decimals": "6",
        "value": "2999085905"
    },
    "transaction_hash": "0x0c90f15c5fc54c438d437e262d61685a3df2e882953438f137f36efff7893c42",
    "type": "token_burning"
};

// Replicating logic from bot.js
function formatAmount(value, decimals) {
    if (!value) return '0';
    return (parseFloat(value) / Math.pow(10, decimals)).toFixed(2);
}

async function simulateOldWithdrawal() {
    console.log('Simulating old withdrawal event processing...');

    const from = mockTx.from?.hash || 'Unknown';
    const amount = formatAmount(mockTx.total?.value, mockTx.token?.decimals || 6);
    const symbol = mockTx.token?.symbol || 'USDC';
    const txHash = mockTx.transaction_hash;
    const explorerLink = `https://explorer.inkonchain.com/tx/${txHash}`;

    const message = `
🚨 *SIMULATION - Old Replay* 🚨

💰 *Amount*: ${amount} ${symbol}
👤 *From*: \`${from.slice(0, 6)}...${from.slice(-4)}\`
🔗 [View Transaction](${explorerLink})
    `;

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`Simulation sent successfully for tx: ${txHash}`);
    } catch (err) {
        console.error('Failed to send simulation:', err.message);
    }
}

simulateOldWithdrawal();
