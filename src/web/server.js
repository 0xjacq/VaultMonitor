
const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const path = require('path');

const rateLimit = require('express-rate-limit');

class WebServer {
    constructor(runner, alertManager) {
        this.runner = runner;
        this.alertManager = alertManager;
        this.app = express();

        // Proxy trust (needed for rate limit & secure cookies behind Nginx)
        this.app.set('trust proxy', 1);

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(bodyParser.json());
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use(cookieSession({
            name: 'session',
            keys: [process.env.SESSION_SECRET || 'secret_key_change_me'],
            maxAge: 12 * 60 * 60 * 1000, // 12 hours
            secure: process.env.NODE_ENV === 'production', // Secure cookies in prod (HTTPS)
            httpOnly: true
        }));

        // Rate Limiter for Login
        const loginLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 5, // limit each IP to 5 requests per windowMs
            message: { error: 'Too many login attempts, please try again later.' }
        });
        this.app.use('/auth/login', loginLimiter);

        // Auth Middleware
        this.app.use((req, res, next) => {
            // Debug Auth
            // console.log(`[Middleware] ${req.method} ${req.path} - Session:`, req.session ? req.session.authenticated : 'No Session');

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
        // Serve frontend
        this.app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
        this.app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

        // Auth API
        this.app.post('/auth/login', (req, res) => {
            const { password } = req.body;
            const correctPassword = process.env.UI_PASSWORD || 'admin';

            if (password === correctPassword) {
                req.session.authenticated = true;
                res.json({ success: true });
            } else {
                res.status(401).json({ error: 'Invalid password' });
            }
        });

        this.app.post('/auth/logout', (req, res) => {
            req.session = null;
            res.json({ success: true });
        });

        // API Routes
        const { db } = require('../data/db');
        const StateManager = require('../engine/state_manager');

        // Status
        this.app.get('/api/status', (req, res) => {
            res.json({ status: 'ok', uptime: process.uptime() });
        });

        // Probes List
        this.app.get('/api/probes', (req, res) => {
            // Get config + status
            // We need access to config. In V2, ConfigLoader loads it. 
            // We'll rely on Runner having the config or just reloading it?
            // Actually, Runner has `runningProbes` map.
            // We can enhance Runner to expose the loaded config or probe list.
            // For now, let's assume we can access it via this.runner.
            // We probably need to store config on runner.

            // Quick hack: Read from DB `probe_state` and combine with config if possible.
            // Better: modify Runner to expose `getProbes()`.

            // Since we don't have that yet, let's implement a dummy response 
            // and then go fix Runner to support this.
            // Debugging
            console.log('[API] /api/probes called');
            console.log('[API] this.runner keys:', Object.keys(this.runner));
            if (this.runner.config) {
                console.log('[API] config.probes length:', this.runner.config.probes.length);
            } else {
                console.log('[API] runner.config is UNDEFINED');
            }

            if (this.runner && this.runner.config) {
                const probes = this.runner.config.probes.map(p => {
                    const state = StateManager.getProbeState(p.id);
                    const isRunning = this.runner.runningProbes.has(p.id);
                    return {
                        id: p.id,
                        type: p.type,
                        enabled: p.enabled && isRunning, // logic might vary
                        interval: p.interval,
                        lastBlock: state ? state.last_block : 0,
                        lastUpdate: state ? state.updated_at : null
                    };
                });
                res.json(probes);
            } else {
                res.json([]);
            }
        });

        // Control: Enable/Disable/Run/Mute
        this.app.post('/api/probes/:id/:action', async (req, res) => {
            const { id, action } = req.params;
            const { duration } = req.body || {}; // for mute, safe check

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
                    const muteDuration = duration || 15; // default 15 min
                    await this.runner.muteProbe(id, muteDuration);
                    res.json({ success: true, message: `Probe ${id} muted for ${muteDuration}m` });
                } else {
                    res.status(400).json({ error: `Invalid action: ${action}` });
                }
            } catch (e) {
                console.error('[API] Control Error:', e);
                res.status(500).json({ error: e.message });
            }
        });

        // Alerts List
        this.app.get('/api/alerts', (req, res) => {
            const limit = req.query.limit || 50;
            const rows = db.prepare('SELECT * FROM sent_alerts ORDER BY sent_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });

        // Runs History (Logs)
        this.app.get('/api/runs', (req, res) => {
            const limit = req.query.limit || 50;
            const rows = db.prepare('SELECT * FROM run_history ORDER BY created_at DESC LIMIT ?').all(limit);
            res.json(rows);
        });

        // Config Editor
        const fs = require('fs');
        const ConfigLoader = require('../utils/config_loader');
        const configPath = path.join(__dirname, '../../config/config.yaml');

        this.app.get('/api/config', (req, res) => {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                res.json({ content });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });

        this.app.post('/api/config', (req, res) => {
            const { content } = req.body;
            try {
                // Validate YAML by parsing
                require('yaml').parse(content);

                // Write to file
                fs.writeFileSync(configPath, content, 'utf8');
                res.json({ success: true });
            } catch (e) {
                res.status(400).json({ error: 'Invalid YAML: ' + e.message });
            }
        });

        this.app.post('/api/config/reload', async (req, res) => {
            try {
                console.log('[Web] Reloading configuration...');
                // 1. Stop engine
                this.runner.stop();

                // 2. Load new config
                const newConfig = ConfigLoader.load(configPath);

                // 3. Start engine
                await this.runner.start(newConfig);

                console.log('[Web] Configuration reloaded successfully.');
                res.json({ success: true, message: 'Configuration reloaded and engine restarted.' });
            } catch (e) {
                console.error('[Web] Failed to reload config:', e);
                res.status(500).json({ error: e.message });
            }
        });
    }

    start(port = 3000) {
        // Use HOST env var if set (e.g. 127.0.0.1), otherwise 0.0.0.0 for Docker
        const host = process.env.HOST || '0.0.0.0';
        this.app.listen(port, host, () => {
            console.log(`[Web] Dashboard running at http://${host}:${port}`);
        });
    }
}

module.exports = WebServer;


