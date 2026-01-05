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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Main Entry Point (TypeScript)
 */
const db_1 = require("./data/db");
const config_loader_1 = require("./utils/config-loader");
const path = __importStar(require("path"));
// Initialize database
(0, db_1.initDB)();
// Load configuration
const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config', 'config.yaml');
console.log('[Main] Loading configuration from:', configPath);
try {
    const config = config_loader_1.ConfigLoader.load(configPath);
    console.log(`[Main] Loaded ${config.probes.length} probes`);
    // For now, just validate the config loads successfully
    // Full Runner integration will come in next phase
    console.log('[Main] TypeScript migration successful - config validation passed');
    console.log('[Main] Note: Full probe execution not yet migrated to TS');
}
catch (err) {
    console.error('[Main] Failed to start:', err);
    process.exit(1);
}
//# sourceMappingURL=index.js.map