const BaseProbe = require('../core/base_probe');
const axios = require('axios');

class HttpProbe extends BaseProbe {
    /**
     * Config:
     * - url: string
     * - method: 'GET' | 'POST' (default GET)
     * - headers: Object
     * - body: Object (for POST)
     * - extract: Object { factName: pathString } 
     *      e.g. { "apy": "impliedApy", "tokenPrice": "data.price" }
     */
    constructor(id, config) {
        super(id, config);
        if (!config.url) throw new Error('HttpProbe requires url');
    }

    async run(state) {
        const facts = {};

        try {
            const response = await axios({
                method: this.config.method || 'GET',
                url: this.config.url,
                headers: this.config.headers || {},
                data: this.config.body,
                timeout: this.config.timeout || 15000  // Configurable, default 15s
            });

            const data = response.data;

            // Extract facts based on config
            // If no extract map is provided, maybe flatten the whole object?
            // For safety, let's require 'extract' map or default to top-level keys if simple.

            if (this.config.extract) {
                for (const [factName, path] of Object.entries(this.config.extract)) {
                    facts[factName] = this.getValueByPath(data, path);
                }
            } else {
                // If no mapping, just store the whole data object as 'data'?
                // Or try to use keys as facts
                if (typeof data === 'object' && data !== null) {
                    Object.assign(facts, data);
                }
            }

        } catch (err) {
            console.error(`[HttpProbe:${this.id}] Request failed:`, err.message);
            // We might want to trigger a "health" alert or just log it.
            return [];
        }

        // Evaluate Rules
        // Context could include response time, status code, etc.
        const context = {
            ...state,
            timestamp: Date.now()
        };

        return await this.evaluate(facts, context);
    }

    getValueByPath(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}

module.exports = HttpProbe;
