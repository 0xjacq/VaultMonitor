/**
 * Probe Factory (TypeScript)
 */
import { BaseProbe } from '../core/base-probe';
import { ProbeConfig } from '../types/config';
import { EvmCallProbe } from '../probes/evm-call';
import { HttpProbe } from '../probes/http';

export class ProbeFactory {
    create(config: ProbeConfig): BaseProbe {
        switch (config.type) {
            case 'evm_call':
                return new EvmCallProbe(config.id, config);
            case 'http':
                return new HttpProbe(config.id, config);
            default:
                throw new Error(`Unknown probe type: ${(config as any).type}`);
        }
    }
}
