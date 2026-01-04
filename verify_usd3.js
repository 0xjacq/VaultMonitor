require('dotenv').config();
const { ethers } = require('ethers');

const USD3_PROXY = '0x056B269Eb1f75477a8666ae8C7fE01b64dD55eCc';
const IMPLEMENTATION_SLOT = '0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC';
const RPC_URL = process.env.RPC_URL;

const usd3Abi = [
    'function supplyCap() view returns (uint256)',
    'function totalAssets() view returns (uint256)',
    'function decimals() view returns (uint8)'
];

const RPC_URLS = [
    process.env.RPC_URL,
    'https://rpc-qnd.inkonchain.com',
    'https://ink.drpc.org',
    'https://rpc-gel-sepolia.inkonchain.com' // Check testnet too!
];

async function verify() {
    for (const url of RPC_URLS) {
        if (!url) continue;
        console.log(`\nTesting connection to ${url}...`);
        const provider = new ethers.JsonRpcProvider(url);

        try {
            const net = await provider.getNetwork();
            console.log(`Connected to Chain ID: ${net.chainId} (${net.name})`);

            const code = await provider.getCode(USD3_PROXY);
            console.log(`Proxy Code Length at ${USD3_PROXY}: ${code.length}`);

            if (code.length > 2) {
                console.log(`✅ FOUND CONTRACT ON CHAIN ${net.chainId}!`);
                // Proceed with checks on THIS provider
                await checkCurrentProvider(provider);
                return;
            } else {
                console.log('❌ No code at proxy address on this chain.');
            }
        } catch (e) {
            console.log(`Connection failed: ${e.message}`);
        }
    }
    console.error('❌ Failed to find contract on any tried RPCs.');
}

async function checkCurrentProvider(provider) {
    const contract = new ethers.Contract(USD3_PROXY, usd3Abi, provider);


    console.log('Reading Decimals...');
    try {
        const dec = await contract.decimals();
        console.log(`Decimals: ${dec}`);
    } catch (e) {
        console.log('Decimals failed:', e.code || e.message);
    }

    console.log('Reading Supply Cap...');
    try {
        const cap = await contract.supplyCap();
        console.log(`Supply Cap: ${ethers.formatUnits(cap, 6)} (${cap.toString()})`);
    } catch (e) {
        console.log('SupplyCap failed:', e.code || e.message);
        // Try explicit matching if possible or just log
    }

    console.log('Reading Total Assets...');
    try {
        const assets = await contract.totalAssets();
        console.log(`Total Assets: ${ethers.formatUnits(assets, 6)} (${assets.toString()})`);
    } catch (e) {
        console.log('Total Assets failed:', e.code || e.message);
    }

    console.log('Checking Implementation Slot...');
    const impl = await provider.getStorage(USD3_PROXY, IMPLEMENTATION_SLOT);
    console.log(`Implementation Slot Value: ${impl}`);
    console.log(`Implementation Address: ${ethers.stripZerosLeft(impl)}`);

    console.log('checking code at proxy...');
    const code = await provider.getCode(USD3_PROXY);
    console.log(`Proxy Code Length: ${code.length}`);

    console.log('checking code at implementation...');
    const implAddr = ethers.stripZerosLeft(await provider.getStorage(USD3_PROXY, IMPLEMENTATION_SLOT));
    const implCode = await provider.getCode(implAddr);
    console.log(`Impl Code Length: ${implCode.length}`);

    console.log('✅ Verification Finished');

}


verify();
