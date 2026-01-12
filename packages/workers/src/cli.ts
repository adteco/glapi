#!/usr/bin/env node
/**
 * GLAPI Workers CLI
 *
 * Command-line interface for running projection workers.
 *
 * Usage:
 *   glapi-workers balance-projection [options]
 *   glapi-workers outbox-processor [options]
 *   glapi-workers all [options]
 */

import { Command } from 'commander';
import { BalanceProjectionWorker } from './balance-projection-worker';
import { OutboxProcessor } from './outbox-processor';

const program = new Command();

program
  .name('glapi-workers')
  .description('GLAPI background workers for event processing')
  .version('0.0.0');

// Common options
const addCommonOptions = (cmd: Command) => {
  return cmd
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-i, --interval <ms>', 'Polling interval in milliseconds', '1000')
    .option('-b, --batch-size <size>', 'Batch size for processing', '100')
    .option('-o, --org <id>', 'Organization ID to process');
};

// Balance Projection Worker
addCommonOptions(
  program
    .command('balance-projection')
    .description('Run the GL balance projection worker')
)
  .action(async (options) => {
    console.log('Starting Balance Projection Worker...');

    const worker = new BalanceProjectionWorker({
      verbose: options.verbose,
      pollingIntervalMs: parseInt(options.interval),
      batchSize: parseInt(options.batchSize),
      organizationId: options.org,
    });

    await worker.start();
  });

// Outbox Processor
addCommonOptions(
  program
    .command('outbox-processor')
    .description('Run the event outbox processor')
)
  .option('-m, --max-retries <count>', 'Maximum delivery attempts', '5')
  .action(async (options) => {
    console.log('Starting Outbox Processor...');

    const worker = new OutboxProcessor({
      verbose: options.verbose,
      pollingIntervalMs: parseInt(options.interval),
      batchSize: parseInt(options.batchSize),
      organizationId: options.org,
      maxDeliveryAttempts: parseInt(options.maxRetries),
    });

    await worker.start();
  });

// Run all workers
addCommonOptions(
  program
    .command('all')
    .description('Run all workers')
)
  .action(async (options) => {
    console.log('Starting all workers...');

    const commonConfig = {
      verbose: options.verbose,
      pollingIntervalMs: parseInt(options.interval),
      batchSize: parseInt(options.batchSize),
      organizationId: options.org,
    };

    const balanceWorker = new BalanceProjectionWorker(commonConfig);
    const outboxWorker = new OutboxProcessor(commonConfig);

    // Start all workers
    await Promise.all([balanceWorker.start(), outboxWorker.start()]);
  });

// Health check command
program
  .command('health')
  .description('Check worker health (for running workers via API)')
  .action(async () => {
    console.log('Health check not yet implemented for CLI.');
    console.log('Workers expose health checks via their healthCheck() method.');
  });

// Stats command
program
  .command('stats')
  .description('Show outbox statistics')
  .action(async () => {
    const outbox = new OutboxProcessor();
    const stats = await outbox.getStats();
    console.log('Outbox Statistics:');
    console.log(`  Pending:   ${stats.pending}`);
    console.log(`  Published: ${stats.published}`);
    console.log(`  Failed:    ${stats.failed}`);
    process.exit(0);
  });

// Dead letter management
program
  .command('dead-letter')
  .description('List dead letter (failed) events')
  .option('-l, --limit <count>', 'Maximum events to show', '100')
  .action(async (options) => {
    const outbox = new OutboxProcessor();
    const events = await outbox.getDeadLetterEvents(parseInt(options.limit));

    if (events.length === 0) {
      console.log('No dead letter events found.');
    } else {
      console.log(`Dead Letter Events (${events.length}):`);
      for (const event of events) {
        console.log(`  - ${event.id}: ${event.topic} - ${event.errorMessage}`);
      }
    }
    process.exit(0);
  });

program
  .command('retry-dead-letter <eventId>')
  .description('Retry a dead letter event')
  .action(async (eventId) => {
    const outbox = new OutboxProcessor();
    await outbox.retryDeadLetter(eventId);
    console.log(`Event ${eventId} reset for retry.`);
    process.exit(0);
  });

program.parse();
