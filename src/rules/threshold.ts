/**
 * Threshold Rule (TypeScript)
 */
import { BaseRule } from '../core/base-rule';
import { Facts, Alert, ProbeContext, Severity } from '../types/domain';
import { generateThresholdAlertId } from '../utils/alert-helpers';

interface ThresholdConfig {
    fact: string;
    threshold: number;
    operator: '>' | '>=' | '<' | '<=';
    severity?: Severity;
    title?: string;
    messageTemplate?: string;
}

export class ThresholdRule extends BaseRule<ThresholdConfig> {
    async evaluate(facts: Facts, context: ProbeContext): Promise<Alert | null> {
        const factValue = facts[this.config.fact];
        console.log(`[ThresholdRule:${this.id}] Checking fact '${this.config.fact}': ${factValue}`);

        const val = parseFloat(String(factValue ?? ''));
        if (isNaN(val)) {
            console.log(`[ThresholdRule:${this.id}] Fact value is NaN, skipping`);
            return null;
        }

        const threshold = this.config.threshold;
        let triggered = false;

        switch (this.config.operator) {
            case '>': triggered = val > threshold; break;
            case '>=': triggered = val >= threshold; break;
            case '<': triggered = val < threshold; break;
            case '<=': triggered = val <= threshold; break;
        }

        console.log(`[ThresholdRule:${this.id}] Comparison: ${val} ${this.config.operator} ${threshold} = ${triggered}`);

        const lastStatus = this.getRuleState<string>(context) ?? 'ok';
        console.log(`[ThresholdRule:${this.id}] Last status: ${lastStatus}, Current: ${triggered ? 'triggered' : 'ok'}`);


        if (triggered && lastStatus === 'ok') {
            // Crossed into danger zone
            this.setRuleState(context, 'triggered');

            return {
                id: generateThresholdAlertId(context.probeId, this.id),
                probeId: context.probeId,
                ruleId: this.id,
                severity: this.config.severity || Severity.WARNING,
                title: this.config.title || 'Threshold Breached',
                message: this.formatMessage(val, threshold),
                timestamp: Date.now(),
                entities: {
                    Value: val.toLocaleString(),
                    Threshold: threshold.toLocaleString()
                }
            };
        } else if (!triggered) {
            // Reset state if back to normal
            this.setRuleState(context, 'ok');
        }

        return null;
    }

    private formatMessage(val: number, threshold: number): string {
        if (!this.config.messageTemplate) return `Value ${val} crossed threshold ${threshold}`;
        return this.config.messageTemplate
            .replace('${value}', val.toLocaleString())
            .replace('${threshold}', threshold.toLocaleString());
    }
}
