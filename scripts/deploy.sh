#!/bin/bash
# =============================================================================
# VaultMonitor VPS Deployment Script
# =============================================================================
# This script sets up VaultMonitor on a fresh VPS with Docker.
#
# Usage:
#   ./scripts/deploy.sh [setup|update|logs|status|backup|restore]
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - SSH access to the VPS
#   - .env file with secrets configured
# =============================================================================

set -e

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/vaultmonitor}"
BACKUP_DIR="${BACKUP_DIR:-/opt/vaultmonitor/backups}"
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/your-username/vaultmonitor:latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Setup: Initial deployment
# =============================================================================
setup() {
    log_info "Setting up VaultMonitor on VPS..."

    # Create deployment directory
    sudo mkdir -p "$DEPLOY_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown -R "$USER:$USER" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"

    # Create necessary directories
    mkdir -p config

    # Check for required files
    if [[ ! -f ".env" ]]; then
        log_warn ".env file not found. Creating from example..."
        cat > .env << 'EOF'
# VaultMonitor Environment Variables
# Fill in your values below

# Telegram notifications (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Web dashboard (required)
UI_PASSWORD=changeme
SESSION_SECRET=generate-a-secure-random-string-here

# GitHub Container Registry
GITHUB_REPOSITORY=your-username/vaultmonitor
IMAGE_TAG=latest
EOF
        log_error "Please edit .env file with your configuration and run setup again."
        exit 1
    fi

    if [[ ! -f "config/config.yaml" ]]; then
        log_error "config/config.yaml not found. Please create your monitoring configuration."
        exit 1
    fi

    # Download docker-compose.prod.yml if not present
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_info "Downloading $COMPOSE_FILE..."
        curl -fsSL "https://raw.githubusercontent.com/${GITHUB_REPOSITORY:-your-username/vaultmonitor}/main/docker-compose.prod.yml" -o "$COMPOSE_FILE"
    fi

    # Pull and start the container
    log_info "Pulling Docker image..."
    docker compose -f "$COMPOSE_FILE" pull

    log_info "Starting VaultMonitor..."
    docker compose -f "$COMPOSE_FILE" up -d

    # Wait for health check
    log_info "Waiting for application to start..."
    sleep 10

    # Check status
    if curl -sf http://localhost:3000/api/status > /dev/null 2>&1; then
        log_success "VaultMonitor is running!"
        log_info "Dashboard: http://localhost:3000 (configure Nginx for HTTPS)"
    else
        log_error "Application failed to start. Check logs with: ./deploy.sh logs"
        exit 1
    fi
}

# =============================================================================
# Update: Pull latest image and restart
# =============================================================================
update() {
    log_info "Updating VaultMonitor..."
    cd "$DEPLOY_DIR"

    # Backup before update
    backup

    # Pull latest image
    log_info "Pulling latest image..."
    docker compose -f "$COMPOSE_FILE" pull

    # Restart with new image
    log_info "Restarting container..."
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

    # Wait and verify
    sleep 10
    if curl -sf http://localhost:3000/api/status > /dev/null 2>&1; then
        log_success "Update complete!"
    else
        log_error "Update failed. Rolling back..."
        docker compose -f "$COMPOSE_FILE" down
        restore
        exit 1
    fi

    # Cleanup
    log_info "Cleaning up old images..."
    docker image prune -f
}

# =============================================================================
# Logs: Show container logs
# =============================================================================
logs() {
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

# =============================================================================
# Status: Check container status
# =============================================================================
status() {
    cd "$DEPLOY_DIR"
    echo ""
    log_info "Container Status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    log_info "Health Check:"
    if curl -sf http://localhost:3000/api/status; then
        echo ""
        log_success "Application is healthy!"
    else
        log_error "Application is not responding!"
    fi
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream vault-monitor 2>/dev/null || log_warn "Container not running"
}

# =============================================================================
# Backup: Backup database and config
# =============================================================================
backup() {
    log_info "Creating backup..."
    cd "$DEPLOY_DIR"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

    # Get database from volume
    VOLUME_PATH=$(docker volume inspect vaultmonitor-data --format '{{ .Mountpoint }}' 2>/dev/null || echo "")

    if [[ -n "$VOLUME_PATH" ]]; then
        sudo tar -czf "$BACKUP_FILE" \
            -C "$DEPLOY_DIR" config \
            -C "$VOLUME_PATH" . 2>/dev/null || true
    else
        tar -czf "$BACKUP_FILE" config 2>/dev/null || true
    fi

    log_success "Backup created: $BACKUP_FILE"

    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
}

# =============================================================================
# Restore: Restore from backup
# =============================================================================
restore() {
    if [[ -z "$1" ]]; then
        # Use latest backup
        BACKUP_FILE=$(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -1)
    else
        BACKUP_FILE="$1"
    fi

    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "No backup file found!"
        exit 1
    fi

    log_info "Restoring from: $BACKUP_FILE"
    cd "$DEPLOY_DIR"

    # Stop container
    docker compose -f "$COMPOSE_FILE" down

    # Restore files
    tar -xzf "$BACKUP_FILE" -C "$DEPLOY_DIR"

    # Restart
    docker compose -f "$COMPOSE_FILE" up -d

    log_success "Restore complete!"
}

# =============================================================================
# Main
# =============================================================================
case "${1:-}" in
    setup)
        setup
        ;;
    update)
        update
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    *)
        echo "VaultMonitor Deployment Script"
        echo ""
        echo "Usage: $0 {setup|update|logs|status|backup|restore}"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial deployment (first time)"
        echo "  update  - Pull latest image and restart"
        echo "  logs    - Show container logs"
        echo "  status  - Check container status"
        echo "  backup  - Backup database and config"
        echo "  restore - Restore from backup"
        exit 1
        ;;
esac
