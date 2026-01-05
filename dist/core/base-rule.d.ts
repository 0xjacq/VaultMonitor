/**
 * Base Rule Class (TypeScript)
 */
import { Facts, Alert, ProbeContext } from '../types/domain';
export declare abstract class BaseRule<TConfig = any> {
    readonly id: string;
    protected readonly config: TConfig;
    constructor(id: string, config: TConfig);
    /**
     * Evaluate facts against rule logic
     */
    abstract evaluate(facts: Facts, context: ProbeContext): Promise<Alert | Alert[] | null>;
    /**
     * Helper to access rule-specific state
     */
    protected getRuleState<T = unknown>(context: ProbeContext): T | undefined;
    /**
     * Helper to set rule-specific state
     */
    protected setRuleState(context: ProbeContext, data: unknown): void;
}
//# sourceMappingURL=base-rule.d.ts.map