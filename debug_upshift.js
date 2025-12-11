const puppeteer = require('puppeteer');
const fs = require('fs');

const url = 'https://app.upshift.finance/api/proxy/vault_summary?vault=0x8fFDcd8A96d293f45aA044d10b899F9D71897E8a';

async function debug() {
    console.log('Starting debug session...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set UA
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log('Navigating to URL...');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('Page loaded. Waiting 5s for any JS challenges...');
        await new Promise(r => setTimeout(r, 5000));

        const content = await page.content(); // Full HTML
        const innerText = await page.evaluate(() => document.body.innerText);

        console.log('--- Body Text Start ---');
        console.log(innerText);
        console.log('--- Body Text End ---');

        fs.writeFileSync('debug_dump.html', content);
        console.log('Saved page HTML to debug_dump.html');

    } catch (e) {
        console.error('Debug error:', e);
    } finally {
        await browser.close();
    }
}

debug();
