/**
 * Generic API Probe (HTTP Platform)
 * 
 * Migrated from legacy http.ts
 * Now uses HttpClient with Circuit Breaker protection
 */

import { BaseProbe } from '../../../core/base-probe';
import { Facts, ProbeState } from '../../../types/domain';
import { setFact } from '../../../utils/fact-helpers';
import { HttpClient } from '../services/http-client';

export interface GenericApiProbeConfig {
    id: string;
    platform: string;
    type: string;
    enabled: boolean;
    interval: number;
    timeout: number;
    config: {
        url: string;
        method?: 'GET' | 'POST';
        headers?: Record<string, string>;
        body?: any;
        extract?: Record<string, string>;  // fact name -> JSONPath or dot notation
    };
    rules?: any[];
}

/**
 * Generic API Probe - makes HTTP requests and extracts facts
 */
export class GenericApiProbe extends BaseProbe<GenericApiProbeConfig> {
    constructor(
        id: string,
        config: GenericApiProbeConfig,
        private readonly httpClient: HttpClient
    ) {
        super(id, config);
    }

    async collect(state: ProbeState): Promise<Facts> {
        const facts: Facts = {};

        try {
            // Make HTTP request
            const response = await this.httpClient.request({
                url: this.config.config.url,
                method: this.config.config.method || 'GET',
                headers: this.config.config.headers,
                body: this.config.config.body,
                timeout: this.config.timeout
            });

            // Extract facts from response
            if (this.config.config.extract) {
                for (const [factName, path] of Object.entries(this.config.config.extract)) {
                    const value = this.extractValue(response, path);
                    setFact(facts, `http.${factName}`, value);
                }
            } else {
                // If no extraction specified, store entire response
                setFact(facts, 'http.response', response);
            }

            setFact(facts, 'http.status', 'success');
        } catch (err) {
            console.error(`[GenericApiProbe:${this.id}] Request failed:`, err);
            setFact(facts, 'http.status', 'error');
            setFact(facts, 'http.error', err instanceof Error ? err.message : String(err));
        }

        return facts;
    }

    /**
     * Extract value from response using dot notation or JSONPath
     * Currently supports simple dot notation (e.g., "data.price")
     */
    private extractValue(obj: any, path: string): any {
        if (!path) return obj;

        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return null;
            }

            // Support array indices: data.items[0].name
            const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, key, index] = arrayMatch;
                current = current[key]?.[parseInt(index)];
            } else {
                current = current[part];
            }
        }

        return current;
    }
}
