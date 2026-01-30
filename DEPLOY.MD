VaultMonitor Deployment Analysis Summary                           
                                                                          
       Current Deployment Architecture                                    
                                                                          
       VaultMonitor uses a modern containerized deployment approach       
       with multi-stage Docker builds, GitHub Container Registry, and     
       automated CI/CD via GitHub Actions.                                
                                                                          
       ---                                                                
       1. Docker Setup                                                    
                                                                          
       Dockerfile (/Users/joe/Dev/Projects/VaultMonitor/Dockerfile)       
                                                                          
       - Multi-stage build optimized for production:                      
         - Stage 1 (Builder): Compiles TypeScript using Node.js 20        
       Alpine with build tools (python3, make, g++) for native modules    
        (better-sqlite3)                                                  
         - Stage 2 (Production): Minimal runtime image with only          
       production dependencies                                            
       - Security features:                                               
         - Runs as non-root user (vaultmonitor:1001)                      
         - Minimal attack surface (Alpine base)                           
       - Health check: Built-in health monitoring via /api/status         
       endpoint (30s interval)                                            
       - Exposed port: 3000                                               
       - Key directories:                                                 
         - /app/dist - Compiled JavaScript                                
         - /app/src/web/public - Static web assets                        
         - /app/config - Configuration files                              
         - /app/data - SQLite database location                           
                                                                          
       Multi-Architecture Support                                         
                                                                          
       - Builds for both linux/amd64 and linux/arm64 (supports ARM        
       VPS)                                                               
                                                                          
       ---                                                                
       2. Docker Compose Configurations                                   
                                                                          
       docker-compose.yml (Development/Local)                             
                                                                          
       - Binds to localhost:3000 only                                     
       - Mounts local database.sqlite and config.yaml                     
       - Logs limited to 10MB × 3 files                                   
       - Environment: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID from .env      
                                                                          
       docker-compose.prod.yml (Production VPS)                           
                                                                          
       - Image from GHCR: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}       
       - Named volume for database persistence (vaultmonitor-data)        
       - Resource limits: 1 CPU, 512MB RAM (reservations: 0.25 CPU,       
       128MB)                                                             
       - Security: User 1001:1001, read-only config mount                 
       - Required env vars: UI_PASSWORD, SESSION_SECRET                   
       - COOKIE_SECURE=true for HTTPS proxy                               
       - Isolated network: vaultmonitor-network                           
                                                                          
       ---                                                                
       3. CI/CD Pipeline                                                  
                                                                          
       GitHub Actions Workflow (.github/workflows/deploy.yml)             
                                                                          
       Trigger: Push to main, pull requests, manual dispatch              
                                                                          
       Three Jobs:                                                        
                                                                          
       Job 1: Test                                                        
                                                                          
       - Type checking (npm run type-check)                               
       - Unit tests (npm test)                                            
                                                                          
       Job 2: Build                                                       
                                                                          
       - Multi-arch Docker build (amd64 + arm64)                          
       - Push to GitHub Container Registry (ghcr.io)                      
       - Multiple tags: branch name, SHA, latest for main                 
       - SBOM generation for security                                     
       - Buildx cache optimization                                        
                                                                          
       Job 3: Deploy (Production)                                         
                                                                          
       - Conditions: Only on main branch, non-PR pushes                   
       - SSH deployment using appleboy/ssh-action                         
       - Deployment steps:                                                
         a. Login to GHCR                                                 
         b. Pull latest image                                             
         c. Update running container via docker compose -f                
       docker-compose.prod.yml up -d                                      
         d. Wait 10s for startup                                          
         e. Health check via curl http://localhost:3000/api/status        
         f. Cleanup old images                                            
       - Required secrets:                                                
         - VPS_HOST - Server IP/hostname                                  
         - VPS_USER - SSH username                                        
         - VPS_SSH_KEY - Private SSH key                                  
         - VPS_DEPLOY_PATH - Deployment directory (e.g.,                  
       /opt/vaultmonitor)                                                 
         - VPS_PORT - SSH port (default: 22)                              
                                                                          
       ---                                                                
       4. Configuration & Environment Variables                           
                                                                          
       Required Environment Variables (.env.example)                      
                                                                          
       # Telegram (optional)                                              
       TELEGRAM_BOT_TOKEN=your_bot_token                                  
       TELEGRAM_CHAT_ID=your_chat_id                                      
                                                                          
       # Web Dashboard (required)                                         
       UI_PASSWORD=admin                                                  
       SESSION_SECRET=change_me_in_production                             
       PORT=3000                                                          
                                                                          
       # Configuration                                                    
       CONFIG_PATH=./config/config.yaml                                   
                                                                          
       Production-specific variables (docker-compose.prod.yml)            
                                                                          
       GITHUB_REPOSITORY=username/vaultmonitor  # Must be lowercase       
       IMAGE_TAG=latest                                                   
       COOKIE_SECURE=true  # For HTTPS reverse proxy                      
                                                                          
       ---                                                                
       5. Manual Deployment Script                                        
                                                                          
       scripts/deploy.sh                                                  
                                                                          
       Full-featured VPS management script with commands:                 
                                                                          
       - setup - Initial deployment (creates directories, .env, pulls     
       image)                                                             
       - update - Pull latest image, restart with backup                  
       - logs - Stream container logs                                     
       - status - Health check + resource usage                           
       - backup - Backup database + config to                             
       /opt/vaultmonitor/backups                                          
       - restore - Restore from backup                                    
                                                                          
       Features:                                                          
       - Automatic backup before updates                                  
       - Health verification post-deployment                              
       - Keeps last 7 backups                                             
       - Colored output for readability                                   
       - GITHUB_REPOSITORY forced to lowercase                            
                                                                          
       ---                                                                
       6. Reverse Proxy Setup                                             
                                                                          
       nginx.conf (Simple reverse proxy)                                  
                                                                          
       - Listens on port 80                                               
       - Proxies to localhost:3000                                        
       - WebSocket support (Upgrade headers)                              
       - X-Forwarded headers for client IP tracking                       
                                                                          
       Production Nginx (via serversguru-deploy templates)                
                                                                          
       - Health endpoint at /health → /api/status                         
       - Long timeouts for WebSocket (86400s)                             
       - Let's Encrypt SSL automation via Certbot                         
                                                                          
       ---                                                                
       7. serversguru-deploy Integration (NPM Package)

        The project uses the `serversguru-deploy` NPM package for autonomous VPS
        provisioning and deployment.

        Configuration (`deploy.yaml`):

        - Defines VPS specs (type, location, OS)
        - Configures application Docker image and environment variables
        - Sets up health checks and domain/SSL

        Deployment Flow (CI/CD):

        1. GitHub Action triggers on push to main
        2. Builds and pushes Docker image to GHCR
        3. Runs `npx serversguru-deploy deploy`
        4. The tool automatically:
           - Provisions a new VPS if needed (via Servers.guru API)
           - Configures the server (Docker, Firewall, etc.)
           - Deploys the VaultMonitor container
           - Verifies health status

        Manual Deployment:

        You can also run the deployment locally:
        ```bash
        export SERVERSGURU_API_KEY="your-key"
        npx serversguru-deploy deploy
        ```                          
                                                                          
       ---                                                                
       8. Application Build & Startup                                     
                                                                          
       Build Process:                                                     
                                                                          
       npm run build  # TypeScript → dist/ (commonjs, ES2022)             
                                                                          
       Runtime:                                                           
                                                                          
       node dist/index.js                                                 
                                                                          
       Entry Point (src/index.ts):                                        
                                                                          
       1. Load .env file                                                  
       2. Load config/config.yaml                                         
       3. Register platforms (EVM, HTTP, Pendle, Aave)                    
       4. Initialize platforms with configs                               
       5. Create ProbeFactory + RuleFactory                               
       6. Setup AlertManager + Telegram channel                           
       7. Start ProbeRunner (schedules probe execution)                   
       8. Start WebServer (Express on port 3000)                          
       9. Setup graceful shutdown handlers (SIGINT, SIGTERM)              
                                                                          
       Key Dependencies:                                                  
                                                                          
       - ethers - Blockchain RPC interactions                             
       - better-sqlite3 - State persistence (requires native              
       compilation)                                                       
       - express - Web dashboard                                          
       - node-telegram-bot-api - Telegram notifications                   
       - zod - Configuration validation                                   
       - yaml - Config file parsing                                       
                                                                          
       ---                                                                
       9. Data Persistence                                                
                                                                          
       SQLite Database (database.sqlite)                                  
                                                                          
       - Development: Mounted from host filesystem                        
       - Production: Stored in Docker volume vaultmonitor-data            
       - Tables:                                                          
         - probe_state - Probe execution state                            
         - sent_alerts - Alert deduplication                              
         - cooldowns - Rate limiting (15min default)                      
         - run_history - Execution logs                                   
                                                                          
       Configuration (config/config.yaml)                                 
                                                                          
       - Mounted as volume (read-only in production)                      
       - Defines platforms, probes, and rules                             
       - Validated by Zod schemas at startup                              
                                                                          
       ---                                                                
       10. Deployment Options Summary                                     
                                                                          
                                                                          
       Method: docker-compose.yml                                         
       Use Case: Local development                                        
       Complexity: Low                                                    
       Features: Local mounts, fast iteration                             
       ────────────────────────────────────────                           
       Method: docker-compose.prod.yml                                    
       Use Case: Existing VPS                                             
       Complexity: Medium                                                 
       Features: Manual setup, full control                               
       ────────────────────────────────────────                           
       Method: GitHub Actions                                             
       Use Case: Automated CD                                             
       Complexity: Medium                                                 
       Features: Auto-deploy on push to main                              
       ────────────────────────────────────────                           
       Method: scripts/deploy.sh                                          
       Use Case: Manual VPS management                                    
       Complexity: Low                                                    
       Features: Backup/restore, status checks                            
       ────────────────────────────────────────                           
       Method: serversguru-deploy                                         
       Use Case: Autonomous provisioning                                  
       Complexity: High                                                   
       Features: Full VPS lifecycle, SSL automation                       
       ---                                                                
       Key Insights                                                       
                                                                          
       1. Production-ready: Multi-stage builds, non-root user, health     
       checks, resource limits                                            
       2. Flexible deployment: Supports manual, CI/CD, and fully          
       autonomous approaches                                              
       3. Security-conscious: Firewall, fail2ban, SSL automation,         
       read-only mounts                                                   
       4. Observability: Health endpoints, logging limits, status         
       commands                                                           
       5. ARM support: Multi-arch builds enable deployment on ARM VPS     
       (cost-effective)                                                   
       6. State management: SQLite with volumes ensures data              
       persistence across updates                                         
       7. Graceful operations: Backup before updates, health              
       verification, rollback capability   