require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const apiUrl = process.env.API_URL;
const pollInterval = parseInt(process.env.POLL_INTERVAL) || 60000;
const upshiftApiUrl = process.env.UPSHIFT_API_URL;
const upshiftPollInterval = parseInt(process.env.UPSHIFT_POLL_INTERVAL) || 60000;
const persistenceFile = path.join(__dirname, 'last_processed.txt');

// Initialize Bot
const bot = new TelegramBot(token, { polling: false });

console.log('Starting Bot (Aave Ink + Upshift)...');
console.log(`Polling intervals: Aave=${pollInterval}ms, Upshift=${upshiftPollInterval}ms`);

// State
let lastProcessedHash = null;
let lastUpshiftTVL = null;

// Load persistence
if (fs.existsSync(persistenceFile)) {
    lastProcessedHash = fs.readFileSync(persistenceFile, 'utf8').trim();
    console.log(`Loaded last processed hash: ${lastProcessedHash}`);
}

async function monitorAaveInk() {
    try {
        console.log(`[${new Date().toISOString()}] Polling Aave Ink...`);
        const response = await axios.get(apiUrl, {
            headers: { 'accept': 'application/json' }
        });

        const items = response.data.items;
        if (!items || items.length === 0) return;

        const withdrawals = items.filter(item =>
            item.method === 'withdraw' &&
            item.type === 'token_burning'
        );

        withdrawals.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let newLastHash = lastProcessedHash;

        if (!lastProcessedHash) {
            if (withdrawals.length > 0) {
                const latest = withdrawals[withdrawals.length - 1];
                newLastHash = latest.transaction_hash;
                console.log(`[Aave] Initialized baseline hash: ${newLastHash}`);
            }
        } else {
            const rawItems = response.data.items;
            const relevantItems = rawItems.filter(item =>
                item.method === 'withdraw' &&
                item.type === 'token_burning'
            );

            const eventsToProcess = [];
            for (const item of relevantItems) {
                if (item.transaction_hash === lastProcessedHash) break;
                eventsToProcess.push(item);
            }
            eventsToProcess.reverse();

            for (const event of eventsToProcess) {
                await sendNotification(event);
                newLastHash = event.transaction_hash;
            }
        }

        if (newLastHash && newLastHash !== lastProcessedHash) {
            lastProcessedHash = newLastHash;
            fs.writeFileSync(persistenceFile, lastProcessedHash);
            console.log(`[Aave] Updated last hash: ${lastProcessedHash}`);
        }

    } catch (error) {
        console.error('[Aave] Error:', error.message);
    }
}

const puppeteer = require('puppeteer');

const upshiftThreshold = parseFloat(process.env.UPSHIFT_THRESHOLD) || 10000000;

async function monitorUpshift() {
    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set user agent to ensure we pass checks
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Go to URL
        await page.goto(upshiftApiUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for Vercel challenge to resolve (just to be safe)
        await new Promise(r => setTimeout(r, 5000));

        // Get page content (it should be the JSON)
        // Some proxy endpoints return JSON directly in the body, which Puppeteer wraps in <pre> or just text
        // Let's try to parse the innerText of the body
        const content = await page.evaluate(() => document.body.innerText);

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            // Sometimes it wraps in <pre>
            const preContent = await page.evaluate(() => document.querySelector('pre')?.innerText);
            if (preContent) {
                data = JSON.parse(preContent);
            }
        }

        if (!data || !data.data || !data.data.total_assets) {
            console.warn('[Upshift] Could not parse JSON from page content');
            // console.debug('[Upshift] Content received:', content.substring(0, 100));
            return;
        }

        const totalAssets = data.data.total_assets;
        const currentTVL = parseFloat(totalAssets);
        const isBelowThreshold = currentTVL < upshiftThreshold;

        // State tracking for transitions
        // We initialize lastUpshiftTVL with the current value
        if (lastUpshiftTVL === null) {
            lastUpshiftTVL = currentTVL;
            console.log(`[Upshift] Initialized baseline TVL: ${lastUpshiftTVL.toLocaleString()} (Threshold: ${upshiftThreshold.toLocaleString()})`);

            // OPTIONAL: Alert immediately on startup if already below threshold?
            // User said "alerte dès qu'on passe en dessous", usually implies crossing.
            // But if I start the bot and it's ALREADY critical, I probably want to know.
            if (isBelowThreshold) {
                await sendUpshiftAlert(currentTVL, upshiftThreshold);
            }
        } else {
            // Check for transition: Was previously ABOVE (or equal), now BELOW
            // OR check if it KEEPS dropping significantly? User said "alerte dès qu'on passe en dessous".
            // Let's stick to the "Crossed Threshold" logic primarily.

            const wasBelowThreshold = lastUpshiftTVL < upshiftThreshold;

            if (!wasBelowThreshold && isBelowThreshold) {
                // Crossing downwards
                await sendUpshiftAlert(currentTVL, upshiftThreshold);
            }

            // Console log for tracking
            if (currentTVL !== lastUpshiftTVL) {
                console.log(`[Upshift] TVL changed: ${lastUpshiftTVL} -> ${currentTVL}`);
            }

            lastUpshiftTVL = currentTVL;
        }

    } catch (error) {
        console.error('[Upshift] Error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function sendUpshiftAlert(currentTVL, threshold) {
    const message = `
⚠️ *Upshift Vault Alert* ⚠️

📉 *TVL Dropped Below Threshold!*
💰 *Current*: ${currentTVL.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC
🔻 *Threshold*: ${threshold.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC
    `;

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`[Upshift] Alert sent! TVL ${currentTVL} < ${threshold}`);
    } catch (err) {
        console.error('[Upshift] Failed to send Telegram message:', err.message);
    }
}

async function sendNotification(tx) {
    const from = tx.from?.hash || 'Unknown';
    const amount = formatAmount(tx.total?.value, tx.token?.decimals || 6);
    const symbol = tx.token?.symbol || 'USDC';
    const txHash = tx.transaction_hash;
    const explorerLink = `https://explorer.inkonchain.com/tx/${txHash}`;

    const message = `
🚨 *New Aave Withdrawal* 🚨

💰 *Amount*: ${amount} ${symbol}
👤 *From*: \`${from.slice(0, 6)}...${from.slice(-4)}\`
🔗 [View Transaction](${explorerLink})
    `;

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`[Aave] Notification sent for tx: ${txHash}`);
    } catch (err) {
        console.error('[Aave] Failed to send Telegram message:', err.message);
    }
}

function formatAmount(value, decimals) {
    if (!value) return '0';
    return (parseFloat(value) / Math.pow(10, decimals)).toFixed(2);
}

// Start polling
monitorAaveInk();
monitorUpshift();
setInterval(monitorAaveInk, pollInterval);
setInterval(monitorUpshift, upshiftPollInterval);
