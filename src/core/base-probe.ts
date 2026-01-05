/**
 * Base Probe Class (TypeScript)
 */
import { Facts, ProbeState, Alert, ProbeContext } from '../types/domain';
import { ProbeConfig } from '../types/config';

export abstract class BaseProbe<TConfig extends ProbeConfig = ProbeConfig> {
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
