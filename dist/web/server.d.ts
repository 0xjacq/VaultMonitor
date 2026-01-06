import { ProbeRunner } from '../engine/runner';
import { AlertManager } from '../engine/alert-manager';
export declare class WebServer {
    private readonly runner;
    private readonly alertManager;
    private app;
    private server?;
    constructor(runner: ProbeRunner, alertManager: AlertManager);
    private setupMiddleware;
    private setupRoutes;
    start(port?: number): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map