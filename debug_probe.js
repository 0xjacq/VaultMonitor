const ConfigLoader = require('./src/utils/config_loader');
const ProbeFactory = require('./src/engine/factory');
const path = require('path');

async function debugProbe(probeId) {
    console.log(`[Debug] Loading config...`);
    const configPath = path.join(__dirname, 'config', 'config.yaml');
    const config = ConfigLoader.load(configPath);

    const probeConfig = config.probes.find(p => p.id === probeId);
    if (!probeConfig) {
        console.error(`Probe ${probeId} not found in config.`);
        return;
    }

    console.log(`[Debug] Instantiating probe ${probeId}...`);
    const factory = new ProbeFactory();
    const probe = factory.create(probeConfig);

    // Patch run to capture facts (since run() acts as a black box usually)
    // We can just inspect the internal behavior or rely on logs if we had them.
    // Or we can modify EvmCallProbe to return facts? 
    // Actually, EvmCallProbe.run() returns alerts. But we want to see the FACTS.
    // Let's rely on a temporary override or just look at what EvmCallProbe does.
    // Better: let's instantiate it and call a "collect" method if we had one.
    // Current EvmCallProbe.run() does collection AND evaluation.

    // Quick fix: We will redefine the run method on this instance to log facts.
    const originalRun = probe.run.bind(probe);

    // We need to subclass or monkey-patch to see internal variables in `run`
    // Since `run` is one big function in `evm_call.js`, we can't easily hook in.

    // Alternative: Let's running it and observe the output, but better yet, 
    // let's manually execute the logic here for transparency.

    if (probeConfig.type === 'evm_call') {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(probeConfig.rpcUrl);
        console.log(`[Debug] Connecting to RPC: ${probeConfig.rpcUrl}`);

        for (const call of probeConfig.calls) {
            try {
                process.stdout.write(`[Debug] Calling ${call.name}... `);
                const contract = new ethers.Contract(call.target, call.abi, provider);
                const result = await contract[call.method](...(call.args || []));

                let valid = result !== undefined && result !== null;
                let display = valid ? result.toString() : 'ERROR';

                if (call.decimals && valid) {
                    display += ` (${ethers.formatUnits(result, call.decimals)})`;
                }

                console.log(`✅ ${display}`);
            } catch (err) {
                console.log(`❌ FAILED: ${err.message}`);
            }
        }
    } else {
        console.log("Debug not implemented for this probe type yet.");
    }
}

const target = process.argv[2] || 'usd3_monitor';
debugProbe(target).catch(console.error);
