# VaultMonitor Deployment Guide

This guide explains how to deploy VaultMonitor to a VPS using Docker and GitHub Actions CI/CD.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Repository                            │
│                                                                 │
│   Push to main ──▶ GitHub Actions                               │
│                         │                                        │
│                         ├──▶ Run tests                          │
│                         ├──▶ Build Docker image                 │
│                         ├──▶ Push to ghcr.io                    │
│                         └──▶ SSH to VPS ──▶ Deploy              │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                           VPS                                    │
│                                                                 │
│  ┌────────────┐    ┌────────────────┐    ┌─────────────────┐    │
│  │   Nginx    │───▶│  VaultMonitor  │───▶│  SQLite Volume  │    │
│  │   :443     │    │    :3000       │    │                 │    │
│  └────────────┘    └────────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### VPS Requirements

- Docker and Docker Compose installed
- Nginx installed (for reverse proxy)
- SSH access configured
- Ports 80 and 443 open for web traffic

### GitHub Repository Setup

1. Push your code to a GitHub repository
2. Enable GitHub Packages for your repository

## Quick Start

### 1. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_HOST` | VPS IP or hostname | `192.168.1.100` |
| `VPS_USER` | SSH username | `deploy` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH...` |
| `VPS_DEPLOY_PATH` | Deployment directory | `/opt/vaultmonitor` |
| `VPS_PORT` | SSH port (optional) | `22` |

### 2. Prepare VPS

SSH into your VPS and run:

```bash
# Create deployment directory
sudo mkdir -p /opt/vaultmonitor
sudo chown $USER:$USER /opt/vaultmonitor
cd /opt/vaultmonitor

# Create config directory
mkdir config

# Create your monitoring configuration
nano config/config.yaml
```

### 3. Create Environment File

Create `/opt/vaultmonitor/.env`:

```bash
# Telegram notifications (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Web dashboard (required)
UI_PASSWORD=your_secure_password
SESSION_SECRET=$(openssl rand -hex 32)

# GitHub Container Registry
GITHUB_REPOSITORY=your-username/vaultmonitor
IMAGE_TAG=latest
```

### 4. Setup Nginx

```bash
# Copy the example config
sudo cp config/nginx.conf.example /etc/nginx/sites-available/vaultmonitor

# Edit with your domain
sudo nano /etc/nginx/sites-available/vaultmonitor

# Enable the site
sudo ln -s /etc/nginx/sites-available/vaultmonitor /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 5. Deploy

Push to the `main` branch - the CI/CD pipeline will:

1. Run tests
2. Build Docker image
3. Push to GitHub Container Registry
4. SSH to VPS and deploy

## Manual Deployment

If you prefer manual deployment, use the deploy script:

```bash
# Copy the script to your VPS
scp scripts/deploy.sh user@vps:/opt/vaultmonitor/

# SSH to VPS
ssh user@vps

# Run initial setup
cd /opt/vaultmonitor
./deploy.sh setup
```

### Deploy Script Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh setup` | Initial deployment |
| `./deploy.sh update` | Pull latest and restart |
| `./deploy.sh logs` | View container logs |
| `./deploy.sh status` | Check health status |
| `./deploy.sh backup` | Backup database and config |
| `./deploy.sh restore` | Restore from backup |

## Local Development with Docker

Build and run locally:

```bash
# Build the image
docker build -t vaultmonitor:local .

# Run with docker-compose
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Troubleshooting

### Container won't start

```bash
# Check container logs
docker compose -f docker-compose.prod.yml logs

# Check if port is in use
sudo lsof -i :3000

# Verify config file
cat config/config.yaml
```

### Health check fails

```bash
# Test health endpoint manually
curl http://localhost:3000/api/status

# Check container status
docker ps -a

# Restart container
docker compose -f docker-compose.prod.yml restart
```

### Database issues

```bash
# Check volume
docker volume ls
docker volume inspect vaultmonitor-data

# Backup and recreate
./deploy.sh backup
docker compose -f docker-compose.prod.yml down -v
./deploy.sh setup
```

### SSL certificate issues

```bash
# Renew certificate
sudo certbot renew

# Test Nginx config
sudo nginx -t

# Check certificate expiry
sudo certbot certificates
```

## Security Recommendations

1. **Use strong passwords**: Generate `SESSION_SECRET` with `openssl rand -hex 32`
2. **Enable HSTS**: Uncomment the HSTS header in nginx.conf after testing
3. **Firewall**: Only expose ports 80, 443, and SSH
4. **Updates**: Enable automatic security updates on VPS
5. **Backups**: Schedule regular backups with cron

```bash
# Add to crontab for daily backups at 3 AM
0 3 * * * /opt/vaultmonitor/deploy.sh backup
```

## Monitoring the Monitor

Set up external monitoring for VaultMonitor itself:

- Use [UptimeRobot](https://uptimerobot.com) to monitor `https://your-domain.com/api/status`
- Configure Telegram alerts for VaultMonitor downtime
