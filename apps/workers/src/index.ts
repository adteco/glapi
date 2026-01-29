import { config } from './config';
import { logger } from './utils/logger';
import { registerHealthCheck } from './utils/health';
import { startHttpServer } from './server';
import { OutboxProcessor } from './processors/outbox-processor';
import { inProcessPublisher } from './publishers/in-process-publisher';

// Global processor instance for graceful shutdown
let processor: OutboxProcessor | null = null;

/**
 * Main entry point for the workers service
 */
async function main(): Promise<void> {
  logger.info({ env: config.env }, 'Starting GLAPI Workers');

  // Validate configuration
  if (!config.databaseUrl) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Register database health check
  registerHealthCheck('database', async () => {
    try {
      // Simple query to verify connection
      const { db } = await import('@glapi/database');
      await db.execute('SELECT 1');
      return { status: 'pass', timestamp: new Date().toISOString() };
    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Start HTTP server for health/metrics
  await startHttpServer();

  // Create and start the outbox processor
  processor = new OutboxProcessor(config.outbox, inProcessPublisher);

  // Register example event handlers (for development)
  if (config.env === 'development') {
    inProcessPublisher.onAll(async (event) => {
      logger.debug(
        { topic: event.topic, eventId: event.id, payload: event.payload },
        'Event received by in-process handler'
      );
    });
  }

  // Start processing
  await processor.start();

  logger.info('GLAPI Workers started successfully');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  if (processor) {
    await processor.stop();
  }

  logger.info('Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.fatal({ error }, 'Failed to start workers');
  process.exit(1);
});
