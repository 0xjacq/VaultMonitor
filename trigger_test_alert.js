const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, 'usd3_state.json');

// 1. Create dummy state if not exists
if (!fs.existsSync(stateFile)) {
    const initialState = {
        lastBlock: 0,
        lastCap: '40000000000000', // 40M (Fake previous cap)
        lastImplementation: null,
        lastUtilizationState: 'normal'
    };
    fs.writeFileSync(stateFile, JSON.stringify(initialState, null, 2));
    console.log('✅ Created fake state file. Run "node bot.js" now to trigger "Cap Changed" alert.');
} else {
    // 2. Modify existing state
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    // Set lastCap to 1 USDC (very low) so the bot thinks it jumped to 50M
    state.lastCap = '1000000';
    // Also reset block so it scans
    state.lastBlock = 0; // Force re-scan to trigger logic loop

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log('✅ Modified state: lastCap set to 1.00 USD3.');
    console.log('👉 Now run: "node bot.js"');
    console.log('   The bot will detect current cap (50M) != lastCap (1) and send an alert.');
}
