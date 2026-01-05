"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFact = setFact;
exports.getFact = getFact;
exports.validateFactKeys = validateFactKeys;
function setFact(facts, key, value) {
    facts[key] = value;
}
function getFact(facts, key) {
    return facts[key];
}
function validateFactKeys(facts) {
    const invalidKeys = [];
    const validPattern = /^(metric|evm|http)\./;
    for (const key of Object.keys(facts)) {
        if (!validPattern.test(key)) {
            invalidKeys.push(key);
        }
    }
    if (invalidKeys.length > 0) {
        console.warn(`[Facts] Non-conforming keys detected: ${invalidKeys.join(', ')}`);
    }
    return invalidKeys;
}
//# sourceMappingURL=fact-helpers.js.map