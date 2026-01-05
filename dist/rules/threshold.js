"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThresholdRule = void 0;
/**
 * Threshold Rule (TypeScript)
 */
const base_rule_1 = require("../core/base-rule");
const domain_1 = require("../types/domain");
const alert_helpers_1 = require("../utils/alert-helpers");
class ThresholdRule extends base_rule_1.BaseRule {
    async evaluate(facts, context) {
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
            case '>':
                triggered = val > threshold;
                break;
            case '>=':
                triggered = val >= threshold;
                break;
            case '<':
                triggered = val < threshold;
                break;
            case '<=':
                triggered = val <= threshold;
                break;
        }
        console.log(`[ThresholdRule:${this.id}] Comparison: ${val} ${this.config.operator} ${threshold} = ${triggered}`);
        const lastStatus = this.getRuleState(context) ?? 'ok';
        console.log(`[ThresholdRule:${this.id}] Last status: ${lastStatus}, Current: ${triggered ? 'triggered' : 'ok'}`);
        if (triggered && lastStatus === 'ok') {
            // Crossed into danger zone
            this.setRuleState(context, 'triggered');
            return {
                id: (0, alert_helpers_1.generateThresholdAlertId)(context.probeId, this.id),
                probeId: context.probeId,
                ruleId: this.id,
                severity: this.config.severity || domain_1.Severity.WARNING,
                title: this.config.title || 'Threshold Breached',
                message: this.formatMessage(val, threshold),
                timestamp: Date.now(),
                entities: {
                    Value: val.toLocaleString(),
                    Threshold: threshold.toLocaleString()
                }
            };
        }
        else if (!triggered) {
            // Reset state if back to normal
            this.setRuleState(context, 'ok');
        }
        return null;
    }
    formatMessage(val, threshold) {
        if (!this.config.messageTemplate)
            return `Value ${val} crossed threshold ${threshold}`;
        return this.config.messageTemplate
            .replace('${value}', val.toLocaleString())
            .replace('${threshold}', threshold.toLocaleString());
    }
}
exports.ThresholdRule = ThresholdRule;
//# sourceMappingURL=threshold.js.map