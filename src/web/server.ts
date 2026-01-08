/**
 * Web Server (TypeScript)
 */
import express, { Request, Response, NextFunction, Application } from 'express';
import cookieSession from 'cookie-session';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { ProbeRunner } from '../engine/runner';
import { AlertManager } from '../engine/alert-manager';
import { db } from '../data/db';
import { StateManager } from '../engine/state-manager';
import { ConfigLoader } from '../utils/config-loader';
import { PlatformAppConfigSchema } from '../types/platform-config';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validate required security configuration.
 * In production, SESSION_SECRET and UI_PASSWORD must be set.
 * In development, warns but uses insecure defaults.
 */
function validateSecurityConfig(): { sessionSecret: string; uiPassword: string } {
    let sessionSecret = process.env.SESSION_SECRET;
    let uiPassword = process.env.UI_PASSWORD;

    if (isProduction) {
        if (!sessionSecret) {
            throw new Error(
                'SECURITY ERROR: SESSION_SECRET must be set in production. ' +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
            );
        }
        if (!uiPassword) {
            throw new Error(
                'SECURITY ERROR: UI_PASSWORD must be set in production. ' +
                'Set a strong password in your environment variables.'
            );
        }
    } else {
        if (!sessionSecret) {
            sessionSecret = crypto.randomBytes(32).toString('hex');
            console.warn('[Web] WARNING: SESSION_SECRET not set. Using random secret (sessions will not persist across restarts).');
        }
        if (!uiPassword) {
            uiPassword = 'admin';
            console.warn('[Web] WARNING: UI_PASSWORD not set. Using default password "admin". Set UI_PASSWORD for security.');
        }
    }

    return { sessionSecret, uiPassword };
}

const ALLOWED_PROBE_ACTIONS = ['run', 'enable', 'disable', 'mute', 'unmute'] as const;
type ProbeAction = typeof ALLOWED_PROBE_ACTIONS[number];

export class WebServer {
    private app: Application;
    private server?: any; // HTTP server instance
    private readonly securityConfig: { sessionSecret: string; uiPassword: string };

    constructor(
        private readonly runner: ProbeRunner,
        private readonly alertManager: AlertManager
    ) {
        this.securityConfig = validateSecurityConfig();
        this.app = express();

        // Proxy trust (needed for rate limit & secure cookies behind Nginx)
        this.app.set('trust proxy', 1);

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(bodyParser.json());

        // Serve static files from source directory (HTML, CSS, JS)
        const publicPath = path.join(process.cwd(), 'src/web/public');
        this.app.use(express.static(publicPath));

        this.app.use(cookieSession({
            name: 'session',
            keys: [this.securityConfig.sessionSecret],
            maxAge: 12 * 60 * 60 * 1000, // 12 hours
            secure: process.env.COOKIE_SECURE === 'true' || isProduction,
            httpOnly: true,
            sameSite: 'lax' // CSRF protection: cookies not sent on cross-origin requests
        }));

        // Rate Limiter for Login
        const loginLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 5,
            message: { error: 'Too many login attempts, please try again later.' }
        });
        this.app.use('/auth/login', loginLimiter);

        // Auth Middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            // Public routes
            if (req.path === '/login' || req.path === '/auth/login' || req.path === '/api/status') {
                return next();
            }

            // Check auth
            if (req.session && (req.session as any).authenticated) {
                return next();
            }

            console.log(`[Middleware] Unauthorized access to ${req.path}`);

            // API vs Page
            if (req.path.startsWith('/api')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Redirect to login
            res.redirect('/login');
        });
    }

    private setupRoutes(): void {
        const publicPath = path.join(process.cwd(), 'src/web/public');

        // Serve frontend
        this.app.get('/', (req: Request, res: Response) =>
            res.sendFile(path.join(publicPath, 'index.html'))
        );
        this.app.get('/login', (req: Request, res: Response) =>
            res.sendFile(path.join(publicPath, 'login.html'))
        );

        // Auth API
        this.app.post('/auth/login', (req: Request, res: Response) => {
            const { password } = req.body;

            if (password === this.securityConfig.uiPassword) {
                (req.session as any).authenticated = true;
                res.json({ success: true });
            } else {
                res.status(401).json({ error: 'Invalid password' });
            }
        });

        this.app.post('/auth/logout', (req: Request, res: Response) => {
            req.session = null;
            res.json({ success: true });
        });

        // Status
        this.app.get('/api/status', (req: Request, res: Response) => {
            res.json({ status: 'ok', uptime: process.uptime() });
        });

        // Probes List
        this.app.get('/api/probes', (req: Request, res: Response) => {
            const probes = (this.runner as any).config?.probes || [];
            const result = probes.map((p: any) => {
                const state = StateManager.getProbeState(p.id);
                const isRunning = (this.runner as any).runningProbes?.has(p.id) || false;

                return {
                    id: p.id,
                    type: p.type,
                    enabled: p.enabled && isRunning,
                    interval: p.interval,
                    lastBlock: state.probe?.last_block || 0,
                    lastUpdate: null as string | null,
                    mutedUntil: state.probe?.muted_until || null
                };
            });
            res.json(result);
        });

        // Control: Enable/Disable/Run/Mute
        this.app.post('/api/probes/:id/:action', async (req: Request, res: Response) => {
            const { id, action } = req.params;
            const { duration } = req.body || {};

            // Validate action is in allowed list
            if (!ALLOWED_PROBE_ACTIONS.includes(action as ProbeAction)) {
                return res.status(400).json({ error: `Invalid action: ${action}. Allowed: ${ALLOWED_PROBE_ACTIONS.join(', ')}` });
            }

            // Validate probe ID exists
            if (!this.runner.hasProbe(id)) {
                return res.status(404).json({ error: `Probe not found: ${id}` });
            }

            try {
                if (action === 'run') {
                    await this.runner.runProbeById(id);
                    res.json({ success: true, message: `Probe ${id} run started` });
                } else if (action === 'enable') {
                    this.runner.enableProbe(id);
                    res.json({ success: true, message: `Probe ${id} enabled` });
                } else if (action === 'disable') {
                    this.runner.disableProbe(id);
                    res.json({ success: true, message: `Probe ${id} disabled` });
                } else if (action === 'mute') {
                    // Validate duration is a positive number
                    const muteDuration = typeof duration === 'number' && duration > 0 ? duration : 15;
                    if (typeof duration !== 'undefined' && (typeof duration !== 'number' || duration <= 0)) {
                        return res.status(400).json({ error: 'Duration must be a positive number (minutes)' });
                    }
                    await this.runner.muteProbe(id, muteDuration);
                    res.json({ success: true, message: `Probe ${id} muted for ${muteDuration}m` });
                } else if (action === 'unmute') {
                    await this.runner.unmuteProbe(id);
                    res.json({ success: true, message: `Probe ${id} unmuted` });
                }
            } catch (e: any) {
                console.error('[API] Control Error:', e);
                res.status(500).json({ error: e.message });
            }
        });

        // Alerts List
        this.app.get('/api/alerts', (req: Request, res: Response) => {
            const limit = parseInt(req.query.limit as string) || 50;
            const rows = db.prepare('SELECT * FROM sent_alerts ORDER BY sent_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });

        // Runs History (Logs)
        this.app.get('/api/runs', (req: Request, res: Response) => {
            const limit = parseInt(req.query.limit as string) || 50;
            const rows = db.prepare('SELECT * FROM run_history ORDER BY created_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });

        // Config Editor
        const configPath = path.join(__dirname, '../../config/config.yaml');

        this.app.get('/api/config', (req: Request, res: Response) => {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                res.json({ content });
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/config', (req: Request, res: Response) => {
            const { content } = req.body;
            try {
                // Parse YAML
                const parsed = yaml.parse(content);

                // Validate against Zod schema before writing
                const validationResult = PlatformAppConfigSchema.safeParse(parsed);
                if (!validationResult.success) {
                    const errors = validationResult.error.issues.map(issue =>
                        `${String(issue.path.join('.'))}: ${issue.message}`
                    );
                    return res.status(400).json({
                        error: 'Invalid configuration',
                        details: errors
                    });
                }

                // Write to file only after validation passes
                fs.writeFileSync(configPath, content, 'utf8');
                res.json({ success: true });
            } catch (e: any) {
                res.status(400).json({ error: 'Invalid YAML: ' + e.message });
            }
        });

        this.app.post('/api/config/reload', async (req: Request, res: Response) => {
            try {
                console.log('[Web] Reloading configuration...');

                // Stop engine (if stop method exists)
                if (typeof (this.runner as any).stop === 'function') {
                    (this.runner as any).stop();
                }

                // Load new config
                const newConfig = ConfigLoader.load(configPath);

                // Start engine
                await this.runner.start(newConfig);

                console.log('[Web] Configuration reloaded successfully.');
                res.json({ success: true, message: 'Configuration reloaded and engine restarted.' });
            } catch (e: any) {
                console.error('[Web] Failed to reload config:', e);
                res.status(500).json({ error: e.message });
            }
        });
    }

    start(port: number = 3000): void {
        const host = process.env.HOST || '0.0.0.0';
        this.server = this.app.listen(port, host, () => {
            console.log(`[Web] Dashboard running at http://${host}:${port}`);
        });
    }

    stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                console.log('[Web] Stopping server...');
                this.server.close(() => {
                    console.log('[Web] Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
