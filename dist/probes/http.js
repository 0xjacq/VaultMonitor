"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpProbe = void 0;
/**
 * HTTP Probe (TypeScript)
 */
const base_probe_1 = require("../core/base-probe");
const fact_helpers_1 = require("../utils/fact-helpers");
const axios_1 = __importDefault(require("axios"));
class HttpProbe extends base_probe_1.BaseProbe {
    async collect(state) {
        const facts = {};
        try {
            const response = await (0, axios_1.default)({
                method: this.config.method || 'GET',
                url: this.config.url,
                headers: this.config.headers || {},
                data: this.config.body,
                timeout: this.config.timeout || 15000
            });
            const data = response.data;
            // Extract facts based on config
            if (this.config.extract) {
                for (const [factName, path] of Object.entries(this.config.extract)) {
                    const value = this.getValueByPath(data, path);
                    (0, fact_helpers_1.setFact)(facts, `http.${factName}`, value);
                }
            }
            else {
                // Store whole data object as facts if no mapping
                if (typeof data === 'object' && data !== null) {
                    for (const [key, value] of Object.entries(data)) {
                        (0, fact_helpers_1.setFact)(facts, `http.${key}`, value);
                    }
                }
            }
        }
        catch (err) {
            console.error(`[HttpProbe:${this.id}] Request failed:`, err);
            // Return empty facts on error
        }
        return facts;
    }
    getValueByPath(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}
exports.HttpProbe = HttpProbe;
//# sourceMappingURL=http.js.map