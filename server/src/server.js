import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

/**
 * Process entry point. The database connection is established BEFORE the
 * listener opens, so Render's health check never sees an instance that accepts
 * traffic it cannot serve. A failure here exits non-zero so the platform
 * retries the deploy rather than leaving a broken instance running.
 */
async function start() {
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Could not connect to MongoDB. Check MONGODB_URI and your Atlas IP allow-list.');
    logger.error(error.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`SplitMate API listening on port ${config.port} (${config.env})`);
    logger.info(`Allowed browser origins: ${config.corsOrigins.join(', ') || '(none)'}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Stop the other process or set PORT.`);
    } else {
      logger.error('HTTP server error:', error);
    }
    process.exit(1);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down.`);
    server.close(async () => {
      await disconnectDatabase().catch(() => null);
      process.exit(0);
    });
    // Do not hang forever if a connection refuses to close.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
}

start();
