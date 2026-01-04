
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
            // Public routes
            if (req.path === '/login' || req.path === '/auth/login' || req.path === '/api/status') {
                return next();
            }

            // Check auth
            if (req.session && req.session.authenticated) {
                return next();
            }

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

        // Control: Enable/Disable/Run
        this.app.post('/api/probes/:id/:action', async (req, res) => {
            const { id, action } = req.params;

            try {
                if (action === 'run') {
                    // Trigger manual run
                    // Warning: accessing private method or need public API
                    // Need to expose `runner.runProbeById(id)`
                    await this.runner.runProbeById(id);
                    res.json({ success: true, message: `Probe ${id} run started` });
                } else if (action === 'enable') {
                    // Update valid config in memory & DB? 
                    // MVP: Just update memory for now or simple "enabled" flag in DB override?
                    // User asked for "toggle persistant (DB)".
                    // So we must modify config or store override in DB.
                    // Let's implement DB override in StateManager later.
                    res.status(501).json({ error: 'Not implemented yet' });
                } else {
                    res.status(400).json({ error: 'Invalid action' });
                }
            } catch (e) {
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
    }

    start(port = 3000) {
        // Enforce binding to localhost only
        this.app.listen(port, '127.0.0.1', () => {
            console.log(`[Web] Dashboard running at http://127.0.0.1:${port}`);
        });
    }
}


module.exports = WebServer;

