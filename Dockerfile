FROM node:18-alpine

# Install build dependencies for better-sqlite3 (python, make, g++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies (including production ones)
RUN npm install --production

# Copy source code
COPY . .

# Create volume mount points directory structure if needed
RUN mkdir -p /app/data /app/config

# Environment variables
ENV NODE_ENV=production

# CMD to run the service
# We use index.js as entry point
CMD ["node", "index.js", "/app/config/config.yaml"]
