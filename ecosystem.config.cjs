/**
 * PM2 Ecosystem Configuration for Strixun Stream Suite (Windows-Optimized)
 * 
 * This configuration manages all 21+ concurrent services in local development.
 * Uses npm scripts as the entry point for maximum Windows compatibility.
 * 
 * Key Features:
 * - autorestart: false (dev servers have their own HMR/hot reload)
 * - max_restarts: 3 (prevents restart loops)
 * - min_uptime: 10s (only restart if process was running for 10+ seconds)
 * 
 * Usage:
 *   Start all:    pm2 start ecosystem.config.cjs
 *   GUI:          pm2-gui start (then visit http://localhost:8088)
 *   View logs:    pm2 logs <service-name>
 *   Restart:      pm2 restart <service-name>
 *   Stop all:     pm2 stop all
 *   Delete all:   pm2 delete all
 *   Monitor:      pm2 monit
 */

// Helper function to create app config
function createAppConfig(name, filterOrScript, options = {}) {
  return {
    name,
    script: 'pnpm.cmd',
    args: filterOrScript,
    cwd: './',
    env: {
      NODE_ENV: 'development',
      FORCE_COLOR: '1',
      ...(options.port && { PORT: String(options.port) }),
    },
    out_file: `./logs/${name}.log`,
    error_file: `./logs/${name}-error.log`,
    merge_logs: true,
    time: true,
    autorestart: false, // Dev servers handle their own restarts
    watch: false,
    max_restarts: 3,
    min_uptime: '10s',
    kill_timeout: 5000,
  };
}

module.exports = {
  apps: [
    // ========== FRONTEND APPLICATIONS ==========
    createAppConfig('stream-suite', 'dev', { port: 5173 }),
    createAppConfig('mods-hub', '--filter @strixun/mods-hub dev', { port: 3001 }),
    createAppConfig('otp-auth-dashboard', '--filter @strixun/otp-auth-service dev', { port: 5174 }),
    createAppConfig('control-panel', '--filter @strixun/control-panel dev', { port: 5175 }),
    createAppConfig('access-hub', '--filter @strixun/access-hub dev', { port: 5178 }),
    createAppConfig('url-shortener-app', '--filter @strixun/url-shortener-app dev', { port: 5176 }),
    createAppConfig('dice-board-game', '--filter @strixun/dice-board-game dev', { port: 5179 }),

    // ========== BACKEND WORKERS (CLOUDFLARE) ==========
    createAppConfig('otp-auth-worker', '--filter @strixun/otp-auth-service dev:worker', { port: 8787 }),
    createAppConfig('mods-api', '--filter strixun-mods-api dev', { port: 8788 }),
    createAppConfig('twitch-api', '--filter strixun-twitch-api dev', { port: 8789 }),
    createAppConfig('customer-api', '--filter strixun-customer-api dev', { port: 8790 }),
    createAppConfig('music-api', '--filter strixun-music-api dev', { port: 8791 }),
    createAppConfig('chat-signaling', '--filter strixun-chat-signaling dev', { port: 8792 }),
    createAppConfig('url-shortener-worker', '--filter @strixun/url-shortener dev:worker', { port: 8793 }),
    createAppConfig('game-api', '--filter strixun-game-api dev', { port: 8794 }),
    createAppConfig('access-service', '--filter strixun-access-service dev', { port: 8795 }),

    // ========== LIBRARY PACKAGES (WATCH MODE) ==========
    createAppConfig('auth-store', '--filter @strixun/auth-store dev'),
    createAppConfig('api-framework', '--filter @strixun/api-framework dev'),
    createAppConfig('types', '--filter @strixun/types dev'),
    createAppConfig('schemas', '--filter @strixun/schemas dev'),
    createAppConfig('service-client', '--filter @strixun/service-client dev'),
  ],
};
