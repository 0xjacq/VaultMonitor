# =============================================================================
# VaultMonitor - Multi-stage Docker Build
# =============================================================================
# Stage 1: Build TypeScript
# Stage 2: Production runtime
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Compile TypeScript
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3 (requires native compilation)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript to dist/
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
# Also install curl for health checks
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    # Clean up build tools after native module compilation
    apk del python3 make g++ && \
    # Clean npm cache
    npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Copy static web assets (served from src/web/public/)
COPY src/web/public ./src/web/public

# Copy default config (can be overridden by volume mount)
COPY config ./config

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CONFIG_PATH=/app/config/config.yaml

# Expose web dashboard port
EXPOSE 3000

# Health check using the /api/status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/status || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S vaultmonitor && \
    adduser -S vaultmonitor -u 1001 -G vaultmonitor && \
    chown -R vaultmonitor:vaultmonitor /app

USER vaultmonitor

# Start the application
CMD ["node", "dist/index.js"]
