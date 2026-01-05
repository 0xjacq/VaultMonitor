/**
 * Threshold Rule (TypeScript)
 */
import { BaseRule } from '../core/base-rule';
import { Facts, Alert, ProbeContext, Severity } from '../types/domain';
interface ThresholdConfig {
    fact: string;
    threshold: number;
    operator: '>' | '>=' | '<' | '<=';
    severity?: Severity;
    title?: string;
    messageTemplate?: string;
}
export declare class ThresholdRule extends BaseRule<ThresholdConfig> {
    evaluate(facts: Facts, context: ProbeContext): Promise<Alert | null>;
    private formatMessage;
}
export {};
//# sourceMappingURL=threshold.d.ts.map