import { app } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    console.log('[TrustVault] Starting backend server...');
    console.log(`[TrustVault] Environment: ${config.NODE_ENV}`);

    // Ensure database migrations are current
    await runMigrations();

    const server = app.listen(config.PORT, () => {
      console.log(`[TrustVault] Server listening securely on port ${config.PORT}`);
      console.log(`[TrustVault] Health check available at: http://localhost:${config.PORT}/health`);
    });

    const shutdown = async () => {
      console.log('[TrustVault] Shutting down gracefully...');
      server.close(() => {
        console.log('[TrustVault] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('[TrustVault] Fatal error during startup:', error);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer();
}
