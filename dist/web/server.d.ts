import { ProbeRunner } from '../engine/runner';
import { AlertManager } from '../engine/alert-manager';
export declare class WebServer {
    private readonly runner;
    private readonly alertManager;
    private app;
    constructor(runner: ProbeRunner, alertManager: AlertManager);
    private setupMiddleware;
    private setupRoutes;
    start(port?: number): void;
}
//# sourceMappingURL=server.d.ts.map