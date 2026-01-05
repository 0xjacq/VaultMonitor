/**
 * Change Rule (TypeScript)
 */
import { BaseRule } from '../core/base-rule';
import { Facts, Alert, ProbeContext, Severity } from '../types/domain';
import { generateChangeAlertId } from '../utils/alert-helpers';

interface ChangeConfig {
    fact: string;
    severity?: Severity;
    title?: string;
    messageTemplate?: string;
}

export class ChangeRule extends BaseRule<ChangeConfig> {
    async evaluate(facts: Facts, context: ProbeContext): Promise<Alert | null> {
        const currentValue = facts[this.config.fact];
        const lastValue = this.getRuleState<any>(context);

        if (lastValue !== undefined && currentValue !== lastValue) {
            // Value changed - trigger alert
            const alert: Alert = {
                id: generateChangeAlertId(context.probeId, this.id, lastValue, currentValue),
                probeId: context.probeId,
                ruleId: this.id,
                severity: this.config.severity || Severity.INFO,
                title: this.config.title || 'Value Changed',
                message: this.formatMessage(lastValue, currentValue),
                timestamp: Date.now(),
                entities: {
                    'Previous Value': String(lastValue),
                    'New Value': String(currentValue)
                }
            };

            // Update state with new value
            this.setRuleState(context, currentValue);

            return alert;
        }

        // Store current value for next run
        if (lastValue === undefined) {
            this.setRuleState(context, currentValue);
        }

        return null;
    }

    private formatMessage(oldValue: any, newValue: any): string {
        if (!this.config.messageTemplate) {
            return `${this.config.fact} changed from ${oldValue} to ${newValue}`;
        }
        return this.config.messageTemplate
            .replace('${old}', String(oldValue))
            .replace('${new}', String(newValue));
    }
}
