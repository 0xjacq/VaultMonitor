/**
 * Rule Factory (TypeScript)
 */
import { BaseRule } from '../core/base-rule';
import { RuleConfig } from '../types/config';
import { ThresholdRule } from '../rules/threshold';
import { ChangeRule } from '../rules/change';

export class RuleFactory {
    create(config: RuleConfig): BaseRule {
        switch (config.type) {
            case 'threshold':
                return new ThresholdRule(config.id, config as any);
            case 'change':
                return new ChangeRule(config.id, config as any);
            default:
                throw new Error(`Unknown rule type: ${(config as any).type}`);
        }
    }
}

