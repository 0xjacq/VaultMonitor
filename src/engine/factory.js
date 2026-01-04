const EvmCallProbe = require('../probes/evm_call');
const ThresholdRule = require('../rules/threshold');
const ChangeRule = require('../rules/change');
const { ProbeType } = require('../core/types');

const HttpProbe = require('../probes/http');

class ProbeFactory {
    create(config) {
        let probe;
        switch (config.type) {
            case 'evm_call':
            case ProbeType.EVM_CALL:
                probe = new EvmCallProbe(config.id, config);
                break;
            case 'http':
            case ProbeType.HTTP:
                probe = new HttpProbe(config.id, config);
                break;
            default:
                throw new Error(`Unknown probe type: ${config.type}`);
        }

        if (config.rules && Array.isArray(config.rules)) {
            for (const ruleConfig of config.rules) {
                const rule = this.createRule(ruleConfig);
                probe.addRule(rule);
            }
        }

        return probe;
    }

    createRule(config) {
        switch (config.type) {
            case 'threshold':
                return new ThresholdRule(config.id, config);
            case 'change':
                return new ChangeRule(config.id, config);
            default:
                throw new Error(`Unknown rule type: ${config.type}`);
        }
    }
}

module.exports = ProbeFactory;
