/**
 * Base Probe Class (TypeScript)
 */
import { Facts, ProbeState, Alert, ProbeContext } from '../types/domain';
import { ProbeConfig } from '../types/config';

/**
 * Base Probe Class - Platform-agnostic
 * 
 * Generic TConfig allows each platform to define its own probe config structure
 */
export abstract class BaseProbe<TConfig = any> {
    constructor(
        public readonly id: string,
        protected readonly config: TConfig
    ) { }

    /**
     * Main execution - returns facts only
     * Rules are evaluated by Runner
     */
    abstract collect(state: ProbeState): Promise<Facts>;
}
