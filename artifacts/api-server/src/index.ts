import app from './app';
import { logger } from './lib/logger';
import { pool } from '@workspace/db';
import { getQueueBoss } from './lib/queue';

import { ensureDbReady } from './lib/dbInit';

const rawPort = process.env.PORT || '3000';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  await ensureDbReady();
  const server = app.listen(port, async () => {
    logger.info({ port }, 'Server listening');
    // Start background queue if configured
    await getQueueBoss().catch((err) => {
      logger.warn({ err }, 'Failed to initialize background queue');
    });
  });

  return server;
}

const serverPromise = start();

// Graceful shutdown handling
function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');

  serverPromise.then((server) => {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await pool.end();
        logger.info('Database pool closed');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error closing database pool during shutdown');
        process.exit(1);
      }
    });
  });

  // Force close if graceful timeout exceeded
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
