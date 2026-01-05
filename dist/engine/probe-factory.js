"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeFactory = void 0;
const evm_call_1 = require("../probes/evm-call");
const http_1 = require("../probes/http");
class ProbeFactory {
    create(config) {
        switch (config.type) {
            case 'evm_call':
                return new evm_call_1.EvmCallProbe(config.id, config);
            case 'http':
                return new http_1.HttpProbe(config.id, config);
            default:
                throw new Error(`Unknown probe type: ${config.type}`);
        }
    }
}
exports.ProbeFactory = ProbeFactory;
//# sourceMappingURL=probe-factory.js.map