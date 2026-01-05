/**
 * EVM Call Probe (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { EvmCallConfig } from '../types/config';
import { Facts, ProbeState } from '../types/domain';
export declare class EvmCallProbe extends BaseProbe<EvmCallConfig> {
    private readonly provider;
    constructor(id: string, config: EvmCallConfig);
    collect(state: ProbeState): Promise<Facts>;
    private normalizeValue;
}
//# sourceMappingURL=evm-call.d.ts.map