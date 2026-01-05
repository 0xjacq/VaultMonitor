/**
 * Change Rule (TypeScript)
 */
import { BaseRule } from '../core/base-rule';
import { Facts, Alert, ProbeContext, Severity } from '../types/domain';
interface ChangeConfig {
    fact: string;
    severity?: Severity;
    title?: string;
    messageTemplate?: string;
}
export declare class ChangeRule extends BaseRule<ChangeConfig> {
    evaluate(facts: Facts, context: ProbeContext): Promise<Alert | null>;
    private formatMessage;
}
export {};
//# sourceMappingURL=change.d.ts.map