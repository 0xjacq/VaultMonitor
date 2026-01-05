"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebServer = void 0;
/**
 * Web Server (TypeScript)
 */
const express_1 = __importDefault(require("express"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const body_parser_1 = __importDefault(require("body-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const yaml = __importStar(require("yaml"));
const db_1 = require("../data/db");
const state_manager_1 = require("../engine/state-manager");
const config_loader_1 = require("../utils/config-loader");
class WebServer {
    runner;
    alertManager;
    app;
    constructor(runner, alertManager) {
        this.runner = runner;
        this.alertManager = alertManager;
        this.app = (0, express_1.default)();
        // Proxy trust (needed for rate limit & secure cookies behind Nginx)
        this.app.set('trust proxy', 1);
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(body_parser_1.default.json());
        // Serve static files from source directory (HTML, CSS, JS)
        const publicPath = path.join(process.cwd(), 'src/web/public');
        this.app.use(express_1.default.static(publicPath));
        this.app.use((0, cookie_session_1.default)({
            name: 'session',
            keys: [process.env.SESSION_SECRET || 'secret_key_change_me'],
            maxAge: 12 * 60 * 60 * 1000, // 12 hours
            secure: process.env.COOKIE_SECURE === 'true',
            httpOnly: true
        }));
        // Rate Limiter for Login
        const loginLimiter = (0, express_rate_limit_1.default)({
            windowMs: 60 * 1000, // 1 minute
            max: 5,
            message: { error: 'Too many login attempts, please try again later.' }
        });
        this.app.use('/auth/login', loginLimiter);
        // Auth Middleware
        this.app.use((req, res, next) => {
            // Public routes
            if (req.path === '/login' || req.path === '/auth/login' || req.path === '/api/status') {
                return next();
            }
            // Check auth
            if (req.session && req.session.authenticated) {
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
    setupRoutes() {
        const publicPath = path.join(process.cwd(), 'src/web/public');
        // Serve frontend
        this.app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
        this.app.get('/login', (req, res) => res.sendFile(path.join(publicPath, 'login.html')));
        // Auth API
        this.app.post('/auth/login', (req, res) => {
            const { password } = req.body;
            const correctPassword = process.env.UI_PASSWORD || 'admin';
            if (password === correctPassword) {
                req.session.authenticated = true;
                res.json({ success: true });
            }
            else {
                res.status(401).json({ error: 'Invalid password' });
            }
        });
        this.app.post('/auth/logout', (req, res) => {
            req.session = null;
            res.json({ success: true });
        });
        // Status
        this.app.get('/api/status', (req, res) => {
            res.json({ status: 'ok', uptime: process.uptime() });
        });
        // Probes List
        this.app.get('/api/probes', (req, res) => {
            const probes = this.runner.config?.probes || [];
            const result = probes.map((p) => {
                const state = state_manager_1.StateManager.getProbeState(p.id);
                const isRunning = this.runner.runningProbes?.has(p.id) || false;
                return {
                    id: p.id,
                    type: p.type,
                    enabled: p.enabled && isRunning,
                    interval: p.interval,
                    lastBlock: state.probe?.last_block || 0,
                    lastUpdate: null,
                    mutedUntil: state.probe?.muted_until || null
                };
            });
            res.json(result);
        });
        // Control: Enable/Disable/Run/Mute
        this.app.post('/api/probes/:id/:action', async (req, res) => {
            const { id, action } = req.params;
            const { duration } = req.body || {};
            try {
                if (action === 'run') {
                    await this.runner.runProbeById(id);
                    res.json({ success: true, message: `Probe ${id} run started` });
                }
                else if (action === 'enable') {
                    this.runner.enableProbe(id);
                    res.json({ success: true, message: `Probe ${id} enabled` });
                }
                else if (action === 'disable') {
                    this.runner.disableProbe(id);
                    res.json({ success: true, message: `Probe ${id} disabled` });
                }
                else if (action === 'mute') {
                    const muteDuration = duration || 15;
                    await this.runner.muteProbe(id, muteDuration);
                    res.json({ success: true, message: `Probe ${id} muted for ${muteDuration}m` });
                }
                else if (action === 'unmute') {
                    await this.runner.unmuteProbe(id);
                    res.json({ success: true, message: `Probe ${id} unmuted` });
                }
                else {
                    res.status(400).json({ error: `Invalid action: ${action}` });
                }
            }
            catch (e) {
                console.error('[API] Control Error:', e);
                res.status(500).json({ error: e.message });
            }
        });
        // Alerts List
        this.app.get('/api/alerts', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const rows = db_1.db.prepare('SELECT * FROM sent_alerts ORDER BY sent_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });
        // Runs History (Logs)
        this.app.get('/api/runs', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const rows = db_1.db.prepare('SELECT * FROM run_history ORDER BY created_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });
        // Config Editor
        const configPath = path.join(__dirname, '../../config/config.yaml');
        this.app.get('/api/config', (req, res) => {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                res.json({ content });
            }
            catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        this.app.post('/api/config', (req, res) => {
            const { content } = req.body;
            try {
                // Validate YAML by parsing
                yaml.parse(content);
                // Write to file
                fs.writeFileSync(configPath, content, 'utf8');
                res.json({ success: true });
            }
            catch (e) {
                res.status(400).json({ error: 'Invalid YAML: ' + e.message });
            }
        });
        this.app.post('/api/config/reload', async (req, res) => {
            try {
                console.log('[Web] Reloading configuration...');
                // Stop engine (if stop method exists)
                if (typeof this.runner.stop === 'function') {
                    this.runner.stop();
                }
                // Load new config
                const newConfig = config_loader_1.ConfigLoader.load(configPath);
                // Start engine
                await this.runner.start(newConfig);
                console.log('[Web] Configuration reloaded successfully.');
                res.json({ success: true, message: 'Configuration reloaded and engine restarted.' });
            }
            catch (e) {
                console.error('[Web] Failed to reload config:', e);
                res.status(500).json({ error: e.message });
            }
        });
    }
    start(port = 3000) {
        const host = process.env.HOST || '0.0.0.0';
        this.app.listen(port, host, () => {
            console.log(`[Web] Dashboard running at http://${host}:${port}`);
        });
    }
}
exports.WebServer = WebServer;
//# sourceMappingURL=server.js.map