import { BaseRule } from '../core/base-rule';
import { StateManager } from './state-manager';
import { AlertManager } from './alert-manager';
import { ProbeFactory } from './probe-factory';
import { RuleFactory } from './rule-factory';
import { AppConfig } from '../types/config';
export declare class ProbeRunner {
    private readonly probeFactory;
    private readonly ruleFactory;
    private readonly alertManager;
    private readonly stateManager;
    private probeInstances;
    private rulesByProbe;
    private runningProbes;
    private activeLocks;
    config?: AppConfig;
    constructor(probeFactory: ProbeFactory, ruleFactory: RuleFactory, alertManager: AlertManager, stateManager?: typeof StateManager);
    start(config: AppConfig): Promise<void>;
    stop(): void;
    private scheduleProbe;
    private runProbeWithTimeout;
    runProbeById(id: string): Promise<void>;
    enableProbe(id: string): void;
    disableProbe(id: string): void;
    muteProbe(id: string, durationMinutes: number): Promise<void>;
    unmuteProbe(id: string): Promise<void>;
    addRuleToProbe(probeId: string, rule: BaseRule): void;
}
//# sourceMappingURL=runner.d.ts.map