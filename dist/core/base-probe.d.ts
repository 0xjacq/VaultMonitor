/**
 * Base Probe Class (TypeScript)
 */
import { Facts, ProbeState } from '../types/domain';
import { ProbeConfig } from '../types/config';
export declare abstract class BaseProbe<TConfig extends ProbeConfig = ProbeConfig> {
    readonly id: string;
    protected readonly config: TConfig;
    constructor(id: string, config: TConfig);
    /**
     * Main execution - returns facts only
     * Rules are evaluated by Runner
     */
    abstract collect(state: ProbeState): Promise<Facts>;
}
//# sourceMappingURL=base-probe.d.ts.map