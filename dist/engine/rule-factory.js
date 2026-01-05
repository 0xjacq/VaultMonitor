"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleFactory = void 0;
const threshold_1 = require("../rules/threshold");
const change_1 = require("../rules/change");
class RuleFactory {
    create(config) {
        switch (config.type) {
            case 'threshold':
                return new threshold_1.ThresholdRule(config.id, config);
            case 'change':
                return new change_1.ChangeRule(config.id, config);
            default:
                throw new Error(`Unknown rule type: ${config.type}`);
        }
    }
}
exports.RuleFactory = RuleFactory;
//# sourceMappingURL=rule-factory.js.map