/**
 * HTTP Probe (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { HttpProbeConfig } from '../types/config';
import { Facts, ProbeState } from '../types/domain';
import { setFact } from '../utils/fact-helpers';
import axios from 'axios';

export class HttpProbe extends BaseProbe<HttpProbeConfig> {
    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};

        try {
            const response = await axios({
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
                    setFact(facts, `http.${factName}`, value);
                }
            } else {
                // Store whole data object as facts if no mapping
                if (typeof data === 'object' && data !== null) {
                    for (const [key, value] of Object.entries(data)) {
                        setFact(facts, `http.${key}`, value as any);
                    }
                }
            }

        } catch (err) {
            console.error(`[HttpProbe:${this.id}] Request failed:`, err);
            // Return empty facts on error
        }

        return facts;
    }

    private getValueByPath(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}
