# VaultMonitor

VaultMonitor is a robust, platform-based DeFi monitoring system designed to track state changes, liquidity, and other critical metrics across various blockchain protocols and platforms. It features a flexible probe/rule engine, real-time Telegram alerts, and a web dashboard for management.

## Features

- **Platform-Based Architecture**: Modular support for different unified platforms (EVM, Polymarket, Aave, HTTP, etc.).
- **Flexible Engine**:
  - **Probes**: Collect data "Facts" from supported platforms.
  - **Rules**: Define logic for thresholds and percentage changes to trigger alerts.
  - **Alerts**: Configurable routing with deduplication and cooldowns.
- **Telegram Integration**: Direct notifications to your Telegram channels.
- **Web Dashboard**: comprehensive UI to view status, manage probes, and review alert history.
- **Docker Support**: Ready for containerized deployment.
- **Persistence**: SQLite-backed state management for reliability.

## Prerequisites

- **Node.js**: v20+ recommended
- **npm** or **yarn**
- **Docker** & **Docker Compose** (optional, for containerized run)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/VaultMonitor.git
    cd VaultMonitor
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and configure your keys:
    ```env
    TELEGRAM_BOT_TOKEN=your_bot_token
    TELEGRAM_CHAT_ID=your_chat_id
    UI_PASSWORD=secure_password
    SESSION_SECRET=random_session_secret
    PORT=3000
    ```

4.  **Configuration:**
    Create your monitoring configuration in `config/config.yaml`.
    You can use examples from `config/examples/` as a base.
    ```bash
    cp config/examples/polymarket-websocket-example.yaml config/config.yaml
    ```
    *See `src/types/platform-config.ts` for configuration schema details.*

## Usage

### Development

Run the application in watch mode:

```bash
npm run dev
```

### Production

Build and start the application:

```bash
npm run build
npm start
```

### Docker

Build and run using Docker Compose:

```bash
docker-compose up -d --build
```
This will start the monitor service and ensure it restarts on failure.

## Testing

Run the test suite using Vitest:

```bash
npm run test
# OR
npx vitest run
```

## detailed Architecture

VaultMonitor operates on a cycle:
1.  **Config Loader**: Reads YAML config and initializes platforms.
2.  **Probe Runner**: Schedules and executes configured probes.
3.  **Probes**: Fetch data from their respective platforms and return **Facts**.
4.  **Rules**: Evaluate Facts against defined conditions (Threshold, Change).
5.  **Alert Manager**: Processes triggered rules, applying deduplication and cooldowns before sending notifications via Telegram.

### Project Structure

- `src/platforms/`: Platform implementations (EVM, Aave, Polymarket, etc.).
- `src/engine/`: Core logic (ProbeRunner, AlertManager, RuleFactory).
- `src/web/`: Express-based web dashboard.
- `config/`: Configuration files.
- `dist/`: Compiled JavaScript output.

## License

[MIT](LICENSE)
