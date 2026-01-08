# VaultMonitor Architecture

## Overview

VaultMonitor is a **DeFi monitoring system** that tracks blockchain protocols and sends alerts when configurable conditions are met. It uses a **platform-based architecture** where each blockchain/protocol is a self-contained plugin.

```
┌─────────────────────────────────────────────────────────────────┐
│                        config.yaml                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PlatformRegistry                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   EVM    │ │   HTTP   │ │  Pendle  │ │   Aave   │           │
│  │ Platform │ │ Platform │ │ Platform │ │ Platform │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ProbeRunner                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Probe → collect() → Facts → Rules → evaluate() → Alert │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AlertManager                               │
│   mute check → dedup → cooldown → route → record                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │   Telegram   │
                        │   Channel    │
                        └──────────────┘
```

---

## Core Concepts

### 1. Platforms (`src/platforms/`)

A **Platform** is an adapter for a specific blockchain or protocol. Each platform:
- Extends `BasePlatform`
- Defines metadata (id, name, version, supported probe types)
- Creates probe instances for its domain
- Manages its own API clients and circuit breakers

```typescript
// src/platforms/base-platform.ts
abstract class BasePlatform {
    abstract readonly metadata: PlatformMetadata;
    abstract initialize(config: PlatformConfig): Promise<void>;
    abstract createProbe(type: string, config: any): BaseProbe;
    abstract destroy(): Promise<void>;
}
```

**Current platforms:**

| Platform | ID | Probe Types |
|----------|-----|-------------|
| EVM | `evm` | `contract_call` |
| HTTP | `http` | `generic_api` |
| Pendle | `pendle` | `market_apy`, `pool_liquidity` |
| Aave | `aave` | `user_position`, `liquidation_risk` |

---

### 2. Probes (`src/core/base-probe.ts`)

A **Probe** collects data and returns **Facts**. Probes are stateless data collectors.

```typescript
abstract class BaseProbe<TConfig = any> {
    abstract collect(state: ProbeState): Promise<Facts>;
}
```

**Example:** Pendle's `market_apy` probe calls the Pendle API and returns:
```typescript
{
    "pendle.impliedApy": 0.15,
    "pendle.underlyingApy": 0.08,
    "pendle.totalLiquidity": 1500000
}
```

---

### 3. Facts & Namespacing

**Facts** are key-value pairs with platform-prefixed keys:

```typescript
type Facts = Record<string, FactValue>;
type FactValue = number | string | boolean | bigint | null;
```

| Platform | Example Facts |
|----------|---------------|
| Pendle | `pendle.impliedApy`, `pendle.totalLiquidity` |
| Aave | `aave.healthFactor`, `aave.riskLevel` |
| EVM | `evm.block`, `evm.balance` |

---

### 4. Rules (`src/rules/`)

**Rules** evaluate facts and generate alerts. Each rule has access to the current facts and persisted state.

```typescript
abstract class BaseRule<TConfig = any> {
    abstract evaluate(facts: Facts, context: ProbeContext): Promise<Alert | Alert[] | null>;
}
```

**Rule types:**

| Type | Purpose | Example |
|------|---------|---------|
| `threshold` | Alert when value crosses threshold | `pendle.impliedApy > 0.15` |
| `change` | Alert on percentage change | `pendle.totalLiquidity` drops 20% |

---

### 5. Alert Pipeline (`src/engine/alert-manager.ts`)

Alerts pass through a **5-stage pipeline**:

```
1. MUTE CHECK    → Is probe muted? Skip if yes
2. DEDUP         → Already sent this exact alert? Skip
3. COOLDOWN      → Same probe+rule alerted recently? Skip (15min default)
4. ROUTE         → Send to all registered channels (Telegram)
5. RECORD        → Save to database for history
```

---

### 6. State Management (`src/engine/state-manager.ts`)

State is persisted in SQLite with **namespaced structure**:

```typescript
interface ProbeState {
    probe: Record<string, unknown>;   // Probe-level state
    rule: Record<string, Record<string, unknown>>;  // Per-rule state
}
```

**Tables:**

| Table | Purpose |
|-------|---------|
| `probe_state` | Persisted state per probe (last values, etc.) |
| `sent_alerts` | Alert deduplication |
| `cooldowns` | Rate limiting per probe+rule |
| `run_history` | Execution logs |

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Startup (index.ts)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Load config.yaml (validated by Zod)                      │
│ 2. Register platforms in PlatformRegistry                   │
│ 3. Initialize platforms (API clients, circuit breakers)     │
│ 4. Create ProbeRunner with factories                        │
│ 5. Start ProbeRunner (schedules all enabled probes)         │
│ 6. Start WebServer (dashboard + API)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Probe Execution Loop                       │
├─────────────────────────────────────────────────────────────┤
│ Every {interval} seconds per probe:                         │
│                                                             │
│ 1. Acquire lock (prevent overlapping runs)                  │
│ 2. Load state from database                                 │
│ 3. probe.collect(state) → Facts                             │
│ 4. For each rule: rule.evaluate(facts, context) → Alerts    │
│ 5. AlertManager.processAlerts(alerts)                       │
│ 6. Save updated state                                       │
│ 7. Record run in history                                    │
│ 8. Release lock                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Schema

```yaml
# config/config.yaml
platforms:
  - platform: pendle
    enabled: true
    config:
      chainIds: [1, 42161]
      rateLimit: 50

probes:
  - id: pendle_usde_market
    platform: pendle           # Which platform creates this probe
    type: market_apy           # Probe type (platform-specific)
    enabled: true
    interval: 60               # Seconds between runs
    timeout: 15000             # Max execution time (ms)
    config:
      chainId: 1
      marketAddress: "0x..."
    rules:
      - id: high_apy_alert
        type: threshold
        fact: pendle.impliedApy
        operator: ">"
        threshold: 0.15
        severity: info
        title: "High APY Detected"
```

---

## Adding a New Platform

1. **Create directory:** `src/platforms/myprotocol/`

2. **Implement platform:**
```typescript
// src/platforms/myprotocol/myprotocol-platform.ts
export class MyProtocolPlatform extends BasePlatform {
    readonly metadata: PlatformMetadata = {
        id: 'myprotocol',
        name: 'My Protocol',
        version: '1.0.0',
        supportedProbeTypes: ['my_probe_type'],
    };

    async initialize(config: PlatformConfig): Promise<void> { /* ... */ }
    createProbe(type: string, config: any): BaseProbe { /* ... */ }
    async destroy(): Promise<void> { /* ... */ }
}
```

3. **Register in index.ts:**
```typescript
import { MyProtocolPlatform } from './platforms/myprotocol';
platformRegistry.register(new MyProtocolPlatform());
```

---

## Key Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Plugin architecture** | PlatformRegistry | Extensible platform support |
| **Factory pattern** | ProbeFactory, RuleFactory | Decouple creation from usage |
| **Circuit breaker** | API clients | Graceful degradation |
| **Lock with watchdog** | ProbeRunner | Prevent stuck probes |
| **Pipeline pattern** | AlertManager | Composable alert processing |
