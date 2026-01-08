# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev

# Run the application
npm start

# Type-check without emitting
npm run type-check

# Run tests with Vitest
npx vitest run

# Run single test file
npx vitest run tests/unit/core/circuit-breaker.test.ts

# Clean build artifacts
npm run clean
```

## Configuration

- Main config: `config/config.yaml` (validated by Zod at startup)
- Example configs in `config/examples/`
- Environment variables: `.env` file (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, UI_PASSWORD, SESSION_SECRET, PORT, CONFIG_PATH)

## Architecture Overview

VaultMonitor is a DeFi monitoring system using a **platform-based architecture** where each blockchain/protocol is a self-contained platform.

### Core Data Flow

```
config.yaml → ConfigLoader → PlatformRegistry → ProbeFactory → ProbeRunner
                                                       ↓
                              Probes collect Facts → Rules evaluate → Alerts
                                                                         ↓
                                            AlertManager pipeline → TelegramChannel
```

### Platform System (`src/platforms/`)

Each platform (e.g., `pendle/`, `aave/`, `evm/`, `http/`) contains:
- `*-platform.ts` - Implements `BasePlatform`, handles initialization and probe creation
- `probes/*.ts` - Platform-specific probes extending `BaseProbe`
- `services/*.ts` - API clients, RPC clients

To add a new platform:
1. Create directory under `src/platforms/`
2. Extend `BasePlatform` with metadata (id, name, version, supportedProbeTypes)
3. Implement `initialize()`, `createProbe()`, `destroy()`
4. Register in `src/index.ts` via `platformRegistry.register()`

### Engine Components (`src/engine/`)

- **ProbeRunner**: Schedules probes, manages locks/timeouts, evaluates rules
- **ProbeFactory**: Delegates probe creation to platforms
- **RuleFactory**: Creates threshold/change rules from config
- **AlertManager**: Pipeline: mute → dedup → cooldown → route → record
- **StateManager**: SQLite-backed state persistence (probe state, cooldowns, run history)
- **PlatformRegistry**: Manages platform lifecycle (init, health checks, destroy)

### Facts & Rules

Probes return `Facts` (Record<string, FactValue>). Facts use platform namespaces:
- `pendle.impliedApy`, `pendle.totalLiquidity`
- `aave.healthFactor`, `aave.riskLevel`
- `evm.block`, `evm.balance`

Rule types (`src/rules/`):
- `threshold`: Compares fact value against threshold with operator (>, >=, <, <=)
- `change`: Detects percentage change from previous value

### Web Dashboard (`src/web/`)

Express server with:
- Session auth (cookie-session)
- Static files from `src/web/public/`
- REST API: `/api/probes`, `/api/alerts`, `/api/runs`, `/api/config`
- Probe control: enable/disable/run/mute/unmute

### Alert Pipeline

AlertManager processes alerts through: mute check → duplicate check → cooldown check → channel routing → recording. Cooldown prevents repeated alerts for same probe+rule within 15 minutes.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry, platform registration, startup |
| `src/platforms/base-platform.ts` | Abstract class all platforms extend |
| `src/core/base-probe.ts` | Abstract class all probes extend |
| `src/core/base-rule.ts` | Abstract class all rules extend |
| `src/types/platform-config.ts` | Zod schemas for config validation |
| `src/types/domain.ts` | Core types: Facts, Alert, Severity, ProbeState |

## Database

SQLite (`database.sqlite`) with tables:
- `probe_state`: Namespaced JSON state per probe
- `sent_alerts`: Alert deduplication
- `cooldowns`: Rate limiting per probe+rule
- `run_history`: Execution logs
