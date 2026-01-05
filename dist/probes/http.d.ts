/**
 * HTTP Probe (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { HttpProbeConfig } from '../types/config';
import { Facts, ProbeState } from '../types/domain';
export declare class HttpProbe extends BaseProbe<HttpProbeConfig> {
    collect(state: ProbeState): Promise<Facts>;
    private getValueByPath;
}
//# sourceMappingURL=http.d.ts.map