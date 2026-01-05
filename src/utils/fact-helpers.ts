/**
 * Fact Helpers - Type-safe fact management (TypeScript version)
 */
import { Facts, FactKey, FactValue } from '../types/domain';

export function setFact(facts: Facts, key: FactKey, value: FactValue): void {
    facts[key] = value;
}

export function getFact(facts: Facts, key: string): FactValue | undefined {
    return facts[key];
}

export function validateFactKeys(facts: Facts): string[] {
    const invalidKeys: string[] = [];
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
