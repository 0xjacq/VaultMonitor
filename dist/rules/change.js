"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeRule = void 0;
/**
 * Change Rule (TypeScript)
 */
const base_rule_1 = require("../core/base-rule");
const domain_1 = require("../types/domain");
const alert_helpers_1 = require("../utils/alert-helpers");
class ChangeRule extends base_rule_1.BaseRule {
    async evaluate(facts, context) {
        const currentValue = facts[this.config.fact];
        const lastValue = this.getRuleState(context);
        if (lastValue !== undefined && currentValue !== lastValue) {
            // Value changed - trigger alert
            const alert = {
                id: (0, alert_helpers_1.generateChangeAlertId)(context.probeId, this.id, lastValue, currentValue),
                probeId: context.probeId,
                ruleId: this.id,
                severity: this.config.severity || domain_1.Severity.INFO,
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
    formatMessage(oldValue, newValue) {
        if (!this.config.messageTemplate) {
            return `${this.config.fact} changed from ${oldValue} to ${newValue}`;
        }
        return this.config.messageTemplate
            .replace('${old}', String(oldValue))
            .replace('${new}', String(newValue));
    }
}
exports.ChangeRule = ChangeRule;
//# sourceMappingURL=change.js.map