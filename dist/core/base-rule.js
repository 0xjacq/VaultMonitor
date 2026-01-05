"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRule = void 0;
class BaseRule {
    id;
    config;
    constructor(id, config) {
        this.id = id;
        this.config = config;
    }
    /**
     * Helper to access rule-specific state
     */
    getRuleState(context) {
        return context.state.rule?.[this.id];
    }
    /**
     * Helper to set rule-specific state
     */
    setRuleState(context, data) {
        if (!context.state.rule)
            context.state.rule = {};
        context.state.rule[this.id] = data;
    }
}
exports.BaseRule = BaseRule;
//# sourceMappingURL=base-rule.js.map