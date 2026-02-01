# VaultMonitor VPS Deployment Plan

## Overview

Deploy VaultMonitor to a new Servers Guru **ARM64** VPS with:
- Telegram notifications enabled
- Custom domain with SSL
- All secrets configured fresh

---

## 1. How the CI/CD Pipeline Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Push to main  │────▶│   GitHub CI     │────▶│  Deploy to VPS  │
│   or manual     │     │   (3 jobs)      │     │  (automatic)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Pipeline Flow (`.github/workflows/deploy.yml`)

| Job | Purpose | Condition |
|-----|---------|-----------|
| **test** | Type-check + Vitest tests | Always (blocks build) |
| **build** | Multi-arch Docker image → ghcr.io | After tests pass |
| **deploy** | `npx serversguru-deploy deploy` | Main branch only |

### Key Points:
- **Trigger**: Push to `main` (excluding .md/docs) or manual dispatch
- **Registry**: GitHub Container Registry (`ghcr.io/username/vaultmonitor`)
- **Architectures**: `linux/amd64` + `linux/arm64` (supports ARM VPS)
- **Deployment**: Uses `serversguru-deploy` NPM package to automatically deploy to your VPS

---

## 2. VPS Specification Requirements

### Minimum Recommended Specs

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **CPU** | 1 vCPU | 2 vCPU | ARM64 or AMD64 supported |
| **RAM** | 512 MB | 1 GB | Container limited to 512MB |
| **Storage** | 10 GB | 20 GB | SQLite DB + Docker images |
| **OS** | Ubuntu 22.04+ | Ubuntu 24.04 | Or Debian 12 |

### Why These Specs:
- Container reserves 128MB, limited to 512MB max
- SQLite database is lightweight
- Docker images need ~200-300MB storage
- Multi-platform builds mean ARM VPS works (cheaper!)

---

## 3. Pre-Deployment Checklist

### A. GitHub Repository Secrets (Required)

Set these in: **Settings → Secrets and variables → Actions**

| Secret | Description | How to Get |
|--------|-------------|------------|
| `SERVERSGURU_API_KEY` | Servers Guru API key | From Servers Guru dashboard |
| `UI_PASSWORD` | Web dashboard login password | Choose a secure password |
| `SESSION_SECRET` | Cookie signing key | Generate: `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | @BotFather on Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (optional) | @userinfobot on Telegram |

### B. GitHub Repository Variables (Optional)

Set these in: **Settings → Secrets and variables → Actions → Variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN_NAME` | `vaultmonitor.local` | Your production domain |
| `ADMIN_EMAIL` | `admin@example.com` | Admin contact email |
| `PRODUCTION_URL` | `your-domain.com` | For environment URL display |

### C. Create config/config.yaml

This is the monitoring configuration. You need a valid config before deploying. The existing `config/config.yaml` is an example Pendle DeFi configuration.

---

## 4. Servers Guru Setup

### What Servers Guru Does:
1. Provisions/manages your VPS
2. Installs Docker automatically
3. Pulls your Docker image from ghcr.io
4. Configures environment variables
5. Sets up nginx reverse proxy with SSL
6. Handles deployments on each CI/CD run

### Steps:
1. **Order VPS** at serversguru with your specs
2. **Get API Key** from Servers Guru dashboard
3. **Add to GitHub Secrets** as `SERVERSGURU_API_KEY`
4. First deploy will provision everything automatically

---

## 5. Post-Deployment Verification

After first successful deploy:

```bash
# Check container status
docker ps
docker logs vault-monitor

# Health check
curl http://localhost:3000/api/status

# If domain configured, check HTTPS
curl https://your-domain.com/api/status
```

---

## 6. Files Overview

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | CI/CD pipeline definition |
| `Dockerfile` | Multi-stage build (Node 20 Alpine) |
| `docker-compose.prod.yml` | Production container config |
| `scripts/deploy.sh` | Manual deployment script (backup) |
| `config/config.yaml` | Your monitoring probes/rules |
| `.env` (on VPS only) | Environment secrets |

---

## 7. Step-by-Step Deployment Process

### Step 1: Order VPS from Servers Guru

**Recommended specs for ARM64:**
- **CPU**: 1-2 ARM vCPU
- **RAM**: 1 GB (512MB minimum)
- **Storage**: 20 GB SSD
- **OS**: Ubuntu 24.04 LTS
- **Location**: Choose closest to your target chains' RPC endpoints

### Step 2: Get Servers Guru API Key

1. Log in to Servers Guru dashboard
2. Navigate to API Keys section
3. Generate new API key
4. Save it securely (you'll add to GitHub)

### Step 3: Set Up Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot` and follow prompts
3. Save the **bot token** (looks like `123456789:ABC...`)
4. Start a chat with your new bot
5. Search for **@userinfobot**, send any message to get your **chat ID**

### Step 4: Configure GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/VaultMonitor/settings/secrets/actions`

**Add these secrets:**

| Secret | Value |
|--------|-------|
| `SERVERSGURU_API_KEY` | Your Servers Guru API key |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID from @userinfobot |
| `UI_PASSWORD` | Choose: `your-secure-password` |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32` |

### Step 5: Configure GitHub Variables

Go to: `https://github.com/YOUR_USERNAME/VaultMonitor/settings/variables/actions`

| Variable | Value |
|----------|-------|
| `DOMAIN_NAME` | `your-domain.com` |
| `ADMIN_EMAIL` | `you@email.com` |
| `PRODUCTION_URL` | `your-domain.com` |

### Step 6: Point Domain to VPS

1. Get VPS IP from Servers Guru dashboard
2. Add DNS records:
   - `A` record: `@` → VPS IP
   - `A` record: `www` → VPS IP (optional)
3. Wait for DNS propagation (~5-30 min)

### Step 7: Customize config/config.yaml

Edit `config/config.yaml` with your DeFi monitoring probes. Current example monitors Pendle markets.

### Step 8: Trigger Deployment

Option A: Push to main branch
```bash
git add config/config.yaml
git commit -m "Configure monitoring probes"
git push origin main
```

Option B: Manual trigger
1. Go to Actions tab in GitHub
2. Select "CI/CD Pipeline"
3. Click "Run workflow"

### Step 9: Verify Deployment

1. Check GitHub Actions completed successfully
2. Visit `https://your-domain.com`
3. Login with your `UI_PASSWORD`
4. Verify probes are running

---

## 8. Verification Plan

After deployment:

```bash
# Via SSH to VPS (if needed for debugging)
docker ps                                    # Container running?
docker logs vault-monitor                    # Any errors?
curl http://localhost:3000/api/status        # Local health check
```

From your machine:
```bash
curl https://your-domain.com/api/status      # HTTPS works?
```

Expected response: `{"status":"ok","uptime":...}`

---

## Summary

**Order VPS** (ARM64, 1GB RAM, 20GB) → **Get API key** → **Create Telegram bot** → **Add 5 secrets + 3 variables to GitHub** → **Point domain** → **Push to main** → **Verify dashboard**
