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
        const val = parseFloat(String(facts[this.config.fact] ?? ''));
        if (isNaN(val))
            return null;
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
        const lastStatus = this.getRuleState(context) ?? 'ok';
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