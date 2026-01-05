"use strict";
/**
 * Domain Types - Core data structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeType = exports.Severity = void 0;
var Severity;
(function (Severity) {
    Severity["INFO"] = "info";
    Severity["WARNING"] = "warning";
    Severity["CRITICAL"] = "critical";
})(Severity || (exports.Severity = Severity = {}));
var ProbeType;
(function (ProbeType) {
    ProbeType["EVM_CALL"] = "evm_call";
    ProbeType["EVM_LOG"] = "evm_log";
    ProbeType["HTTP"] = "http";
})(ProbeType || (exports.ProbeType = ProbeType = {}));
//# sourceMappingURL=domain.js.map