const axios = require('axios');

const url = 'https://app.upshift.finance/api/proxy/vault_summary?vault=0x8fFDcd8A96d293f45aA044d10b899F9D71897E8a';

async function checkUpshift() {
    try {
        console.log('Fetching Upshift data...');
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        console.log('Status:', response.status);
        console.log('Data structure keys:', Object.keys(response.data));

        if (response.data.data && response.data.data.total_assets) {
            console.log('✅ Success! Found total_assets:', response.data.data.total_assets);
            const val = parseFloat(response.data.data.total_assets);
            console.log('Parsed Value:', val.toLocaleString());
        } else {
            console.error('❌ Failed: structure unexpected', JSON.stringify(response.data, null, 2));
        }

    } catch (err) {
        console.error('Request failed:', err.message);
    }
}

checkUpshift();
