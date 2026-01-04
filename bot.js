require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');

// Configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const apiUrl = process.env.API_URL;
const pollInterval = parseInt(process.env.POLL_INTERVAL) || 60000;
const upshiftApiUrl = process.env.UPSHIFT_API_URL;
const upshiftPollInterval = parseInt(process.env.UPSHIFT_POLL_INTERVAL) || 60000;
const rpcUrl = process.env.RPC_URL;
const persistenceFile = path.join(__dirname, 'last_processed.txt');
const usd3StateFile = path.join(__dirname, 'usd3_state.json');

// Feature Flags
const enableAaveInk = process.env.ENABLE_AAVE_INK === 'true';
const enableUpshift = process.env.ENABLE_UPSHIFT === 'true';
const enableUsd3 = process.env.ENABLE_USD3 === 'true';

// USD3 Config
const USD3_PROXY = '0x056B269Eb1f75477a8666ae8C7fE01b64dD55eCc';
const IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
const USD3_POLL_INTERVAL = 60000; // 60s

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

let upshiftBrowser = null;
let upshiftPage = null;

async function initUpshiftBrowser() {
    try {
        console.log('[Upshift] Launching persistent browser...');
        upshiftBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        upshiftPage = await upshiftBrowser.newPage();
        await upshiftPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    } catch (err) {
        console.error('[Upshift] Failed to launch browser:', err.message);
    }
}

async function monitorUpshift() {
    try {
        // Ensure browser is running
        if (!upshiftBrowser || !upshiftPage || upshiftPage.isClosed()) {
            await initUpshiftBrowser();
        }
        if (!upshiftPage) return; // Skip this cycle if init failed

        // Go to URL (or reload if already there)
        try {
            // console.log('[Upshift] Fetching data...');
            await upshiftPage.goto(upshiftApiUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        } catch (navErr) {
            console.warn('[Upshift] Navigation error (retrying next cycle):', navErr.message);
            // If navigation fails significantly, maybe restart browser next time
            if (navErr.message.includes('Session closed')) {
                await upshiftBrowser.close();
                upshiftBrowser = null;
            }
            return;
        }

        // Wait for Vercel challenge (shorter wait is usually fine for reload, but safe to keep 2-5s)
        await new Promise(r => setTimeout(r, 5000));

        const content = await upshiftPage.evaluate(() => document.body.innerText);

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            const preContent = await upshiftPage.evaluate(() => document.querySelector('pre')?.innerText);
            if (preContent) {
                try {
                    data = JSON.parse(preContent);
                } catch (e2) { }
            }
        }

        if (!data || !data.data || !data.data.total_assets) {
            console.warn('[Upshift] Read failure. Page content snippet:', content.substring(0, 50).replace(/\n/g, ' '));
            return;
        }

        const totalAssets = data.data.total_assets;
        const currentTVL = parseFloat(totalAssets);
        const isBelowThreshold = currentTVL < upshiftThreshold;

        console.log(`[Upshift] TVL: ${currentTVL.toLocaleString()} (Threshold: ${upshiftThreshold.toLocaleString()})`);

        if (lastUpshiftTVL === null) {
            lastUpshiftTVL = currentTVL;
            console.log(`[Upshift] Initialized baseline TVL: ${lastUpshiftTVL.toLocaleString()}`);
            if (isBelowThreshold) {
                await sendUpshiftAlert(currentTVL, upshiftThreshold);
            }
        } else {
            const wasBelowThreshold = lastUpshiftTVL < upshiftThreshold;
            if (!wasBelowThreshold && isBelowThreshold) {
                await sendUpshiftAlert(currentTVL, upshiftThreshold);
            }
            lastUpshiftTVL = currentTVL;
        }

    } catch (error) {
        console.error('[Upshift] Critical Error:', error.message);
        // Force restart of browser on critical error
        if (upshiftBrowser) {
            await upshiftBrowser.close().catch(() => { });
            upshiftBrowser = null;
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


// --- USD3 Monitoring Logic ---

const usd3Abi = [
    'function supplyCap() view returns (uint256)',
    'function totalAssets() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'event Upgraded(address indexed implementation)'
];

let usd3State = {
    lastBlock: 0,
    lastCap: '0',
    lastImplementation: null,
    lastUtilizationState: 'normal' // normal, warning, critical, reached
};

// Load USD3 State
if (fs.existsSync(usd3StateFile)) {
    try {
        usd3State = JSON.parse(fs.readFileSync(usd3StateFile, 'utf8'));
        console.log(`[USD3] Loaded state: Block ${usd3State.lastBlock}, Cap ${usd3State.lastCap}`);
    } catch (e) {
        console.error('[USD3] Error loading state:', e.message);
    }
}

function saveUsd3State() {
    try {
        fs.writeFileSync(usd3StateFile, JSON.stringify(usd3State, null, 2));
    } catch (e) {
        console.error('[USD3] Error saving state:', e.message);
    }
}

async function monitorUSD3() {
    if (!rpcUrl) {
        console.warn('[USD3] No RPC_URL configured, skipping monitor.');
        return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const usd3Contract = new ethers.Contract(USD3_PROXY, usd3Abi, provider);

    try {
        const currentBlock = await provider.getBlockNumber();
        const startBlock = usd3State.lastBlock === 0 ? currentBlock - 100 : usd3State.lastBlock + 1;

        // Don't scan too far if bot was off for long time, but for critical events we might want to?
        // Let's cap at 1000 blocks to avoid RPC limits, or just go separate loop for catching up.
        // For simplicity, we scan from lastBlock. If gap is huge, might be slow.
        // Let's limit to last 5000 blocks safety net.
        const safeStartBlock = Math.max(startBlock, currentBlock - 5000);

        // 1. Check for Upgrades & Cap Changes via Events
        try {
            if (safeStartBlock <= currentBlock) {
                // Fetch logs
                const filter = usd3Contract.filters.Upgraded();
                const logs = await usd3Contract.queryFilter(filter, safeStartBlock, currentBlock);

                // Check Cap
                const currentCap = await usd3Contract.supplyCap();
                const currentCapFormatted = currentCap.toString();

                let capChanged = false;
                if (usd3State.lastCap !== '0' && usd3State.lastCap !== currentCapFormatted) {
                    capChanged = true;
                    const oldCapHuman = ethers.formatUnits(usd3State.lastCap, 6);
                    const newCapHuman = ethers.formatUnits(currentCap, 6);

                    await sendUsd3Alert({
                        type: 'CAP_CHANGED',
                        oldCap: oldCapHuman,
                        newCap: newCapHuman,
                        block: currentBlock,
                        txHash: logs.length > 0 ? logs[logs.length - 1].transactionHash : 'Detected via polling'
                    });

                    usd3State.lastCap = currentCapFormatted;
                } else if (usd3State.lastCap === '0') {
                    // First run initialization
                    usd3State.lastCap = currentCapFormatted;
                    console.log(`[USD3] Initialized Cap: ${ethers.formatUnits(currentCap, 6)}`);
                }

                // Upgrade Detection (Events & Storage Slot)
                let currentImpl = usd3State.lastImplementation;
                try {
                    // This call was failing intermittently (RPC 500), so we isolate it
                    currentImpl = await provider.getStorage(USD3_PROXY, IMPLEMENTATION_SLOT);
                    const normalizedImpl = ethers.stripZerosLeft(currentImpl);

                    if (logs.length > 0) {
                        if (!capChanged) {
                            await sendUsd3Alert({
                                type: 'UPGRADED',
                                block: currentBlock,
                                txHash: logs[0].transactionHash
                            });
                        }
                    } else if (usd3State.lastImplementation && usd3State.lastImplementation !== currentImpl) {
                        if (!capChanged) {
                            await sendUsd3Alert({
                                type: 'UPGRADED_SLOT',
                                block: currentBlock,
                                implementation: normalizedImpl
                            });
                        }
                    }
                    usd3State.lastImplementation = currentImpl;
                } catch (slotErr) {
                    console.warn(`[USD3] Implementation check skipped: ${slotErr.code || slotErr.message}`);
                }

                usd3State.lastBlock = currentBlock;
                saveUsd3State();
            }
        } catch (eventErr) {
            console.error('[USD3] Event/Upgrade check error:', eventErr.message);
        }

        // 2. Monitor 50M Limit (Assets or Cap > 50M)
        try {
            const totalAssets = await usd3Contract.totalAssets();
            const cap = await usd3Contract.supplyCap(); // reload to be sure

            const limit = ethers.parseUnits("50000000", 6); // 50M with 6 decimals

            const assetsHuman = ethers.formatUnits(totalAssets, 6);
            const capHuman = ethers.formatUnits(cap, 6);

            // Check Assets
            let assetsOver = totalAssets > limit;
            let capOver = cap > limit;

            let currentStatus = 'ok';
            if (assetsOver) currentStatus = 'assets_over';
            if (capOver) currentStatus = 'cap_over';
            if (assetsOver && capOver) currentStatus = 'both_over';

            if (currentStatus !== 'ok' && (usd3State.lastUtilizationState !== currentStatus)) {
                await sendUsd3Alert({
                    type: 'THRESHOLD_BREACH',
                    subtype: currentStatus,
                    assets: assetsHuman,
                    cap: capHuman,
                    limit: '50,000,000'
                });
                usd3State.lastUtilizationState = currentStatus;
                saveUsd3State();
            } else if (currentStatus === 'ok' && usd3State.lastUtilizationState !== 'ok' && usd3State.lastUtilizationState !== 'normal') {
                // Reset
                usd3State.lastUtilizationState = 'normal'; // use 'normal' as ok
                console.log('[USD3] Levels returned to normal (<= 50M).');
                saveUsd3State();
            }

        } catch (utilErr) {
            console.warn('[USD3] Threshold check failed:', utilErr.message);
        }

    } catch (err) {
        console.error('[USD3] Monitor error:', err.message);
    }
}

async function sendUsd3Alert(data) {
    let message = '';
    if (data.type === 'CAP_CHANGED') {
        message = `
🚨 *USD3 Supply Cap Changed* 🚨

🏢 *Proxy*: \`${USD3_PROXY.slice(0, 6)}...${USD3_PROXY.slice(-4)}\`
🔴 *Old Cap*: ${parseFloat(data.oldCap).toLocaleString()}
🟢 *New Cap*: ${parseFloat(data.newCap).toLocaleString()}
🔗 [Tx Hash](https://etherscan.io/tx/${data.txHash})
📦 *Block*: ${data.block}
        `;
    } else if (data.type === 'UPGRADED' || data.type === 'UPGRADED_SLOT') {
        message = `
🛠 *USD3 Proxy Upgraded* 🛠
(Supply Cap Unchanged)

🏢 *Proxy*: \`${USD3_PROXY.slice(0, 6)}...${USD3_PROXY.slice(-4)}\`
📦 *Block*: ${data.block}
        `;
    } else if (data.type === 'THRESHOLD_BREACH') {
        const icon = '🚨';
        let reason = '';
        if (data.subtype === 'assets_over') reason = 'Total Assets > 50M';
        if (data.subtype === 'cap_over') reason = 'Supply Cap > 50M';
        if (data.subtype === 'both_over') reason = 'Both Assets & Cap > 50M!';

        message = `
${icon} *USD3 Threshold Alert* ${icon}

⚠️ *Reason*: ${reason}
💰 *Assets*: ${parseFloat(data.assets).toLocaleString()}
🛑 *Cap*: ${parseFloat(data.cap).toLocaleString()}
📏 *Limit*: ${data.limit}
        `;
    }

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`[USD3] Alert sent: ${data.type}`);
    } catch (err) {
        console.error('[USD3] Failed to send Telegram message:', err.message);
    }
}

// Start polling
console.log(`[Config] Aave Ink: ${enableAaveInk}, Upshift: ${enableUpshift}, USD3: ${enableUsd3}`);

if (enableAaveInk) {
    monitorAaveInk();
    setInterval(monitorAaveInk, pollInterval);
}

if (enableUpshift) {
    monitorUpshift();
    setInterval(monitorUpshift, upshiftPollInterval);
}

if (enableUsd3) {
    monitorUSD3(); // Initial run
    setInterval(monitorUSD3, USD3_POLL_INTERVAL);
}

