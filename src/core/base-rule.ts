/**
 * Base Rule Class (TypeScript)
 */
import { Facts, Alert, ProbeContext, ProbeState } from '../types/domain';

export abstract class BaseRule<TConfig = any> {
    constructor(
        public readonly id: string,
        protected readonly config: TConfig
    ) { }

    /**
     * Evaluate facts against rule logic
     */
    abstract evaluate(facts: Facts, context: ProbeContext): Promise<Alert | Alert[] | null>;

    /**
     * Helper to access rule-specific state
     */
    protected getRuleState<T = unknown>(context: ProbeContext): T | undefined {
        return context.state.rule?.[this.id] as T | undefined;
    }

    /**
     * Helper to set rule-specific state
     */
    protected setRuleState(context: ProbeContext, data: unknown): void {
        if (!context.state.rule) context.state.rule = {} as Record<string, Record<string, unknown>>;
        context.state.rule[this.id] = data as Record<string, unknown>;
    }
}
