/**
 * Fact Helpers - Type-safe fact management (TypeScript version)
 */
import { Facts, FactKey, FactValue } from '../types/domain';
export declare function setFact(facts: Facts, key: FactKey, value: FactValue): void;
export declare function getFact(facts: Facts, key: string): FactValue | undefined;
export declare function validateFactKeys(facts: Facts): string[];
//# sourceMappingURL=fact-helpers.d.ts.map