/**
 * Base Worker Class
 *
 * Provides common functionality for all projection workers including:
 * - Lifecycle management (start/stop)
 * - Health checks
 * - Graceful shutdown
 * - Error handling and recovery
 * - Metrics collection
 */

export interface WorkerConfig {
  /** Worker name for logging and metrics */
  name: string;
  /** Polling interval in milliseconds */
  pollingIntervalMs: number;
  /** Batch size for processing */
  batchSize: number;
  /** Maximum retries before giving up */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
  /** Enable verbose logging */
  verbose: boolean;
}

export interface WorkerMetrics {
  /** Total events processed */
  eventsProcessed: number;
  /** Total errors encountered */
  errorsCount: number;
  /** Last processed global sequence */
  lastProcessedSequence: number;
  /** Last processing timestamp */
  lastProcessedAt: Date | null;
  /** Worker start time */
  startedAt: Date | null;
  /** Current processing lag (events behind) */
  processingLag: number;
  /** Average processing time in ms */
  avgProcessingTimeMs: number;
}

export interface WorkerLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: WorkerLogger = {
  debug: (msg, ctx) => console.debug(`[Worker] ${msg}`, ctx || ''),
  info: (msg, ctx) => console.info(`[Worker] ${msg}`, ctx || ''),
  warn: (msg, ctx) => console.warn(`[Worker] ${msg}`, ctx || ''),
  error: (msg, ctx) => console.error(`[Worker] ${msg}`, ctx || ''),
};

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  name: 'base-worker',
  pollingIntervalMs: 1000,
  batchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  verbose: false,
};

/**
 * Abstract base class for projection workers
 */
export abstract class WorkerBase {
  protected config: WorkerConfig;
  protected logger: WorkerLogger;
  protected isRunning: boolean = false;
  protected isPaused: boolean = false;
  protected metrics: WorkerMetrics;
  private processingTimes: number[] = [];
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WorkerConfig> = {}, logger?: WorkerLogger) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
    this.logger = logger || defaultLogger;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): WorkerMetrics {
    return {
      eventsProcessed: 0,
      errorsCount: 0,
      lastProcessedSequence: 0,
      lastProcessedAt: null,
      startedAt: null,
      processingLag: 0,
      avgProcessingTimeMs: 0,
    };
  }

  /**
   * Abstract method to be implemented by concrete workers
   * Process a batch of events and return the number processed
   */
  protected abstract processBatch(): Promise<number>;

  /**
   * Abstract method to get current checkpoint
   */
  protected abstract getCheckpoint(): Promise<number>;

  /**
   * Abstract method to get the latest available sequence
   */
  protected abstract getLatestSequence(): Promise<number>;

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker is already running', { name: this.config.name });
      return;
    }

    this.logger.info('Starting worker', { name: this.config.name, config: this.config });
    this.isRunning = true;
    this.metrics.startedAt = new Date();

    // Register shutdown handlers
    this.registerShutdownHandlers();

    // Start the polling loop
    await this.poll();
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping worker', { name: this.config.name });
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Allow current processing to complete
    await this.onShutdown();

    this.logger.info('Worker stopped', {
      name: this.config.name,
      metrics: this.getMetrics(),
    });
  }

  /**
   * Pause the worker (stop processing but keep running)
   */
  pause(): void {
    this.isPaused = true;
    this.logger.info('Worker paused', { name: this.config.name });
  }

  /**
   * Resume a paused worker
   */
  resume(): void {
    this.isPaused = false;
    this.logger.info('Worker resumed', { name: this.config.name });
  }

  /**
   * Get current metrics
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    reason?: string;
    metrics: WorkerMetrics;
  }> {
    const metrics = this.getMetrics();

    // Check if worker is running
    if (!this.isRunning) {
      return { healthy: false, reason: 'Worker is not running', metrics };
    }

    // Check if worker is stuck (no processing in last 5 minutes)
    if (
      metrics.lastProcessedAt &&
      Date.now() - metrics.lastProcessedAt.getTime() > 5 * 60 * 1000 &&
      metrics.processingLag > 0
    ) {
      return { healthy: false, reason: 'Worker appears stuck', metrics };
    }

    // Check error rate
    const errorRate =
      metrics.eventsProcessed > 0
        ? metrics.errorsCount / metrics.eventsProcessed
        : 0;
    if (errorRate > 0.1) {
      return {
        healthy: false,
        reason: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        metrics,
      };
    }

    return { healthy: true, metrics };
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (!this.isPaused) {
      try {
        const startTime = Date.now();

        // Update lag metric
        const [checkpoint, latest] = await Promise.all([
          this.getCheckpoint(),
          this.getLatestSequence(),
        ]);
        this.metrics.processingLag = Math.max(0, latest - checkpoint);

        // Process batch
        const processed = await this.processBatch();

        if (processed > 0) {
          const processingTime = Date.now() - startTime;
          this.updateProcessingMetrics(processed, processingTime);

          if (this.config.verbose) {
            this.logger.debug('Batch processed', {
              name: this.config.name,
              processed,
              processingTimeMs: processingTime,
              lag: this.metrics.processingLag,
            });
          }
        }
      } catch (error) {
        this.metrics.errorsCount++;
        this.logger.error('Error processing batch', {
          name: this.config.name,
          error: error instanceof Error ? error.message : String(error),
        });

        // Wait before retrying after error
        await this.sleep(this.config.retryDelayMs);
      }
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.config.pollingIntervalMs);
  }

  /**
   * Update processing metrics after a batch
   */
  private updateProcessingMetrics(processed: number, processingTimeMs: number): void {
    this.metrics.eventsProcessed += processed;
    this.metrics.lastProcessedAt = new Date();

    // Keep rolling average of processing times (last 100)
    this.processingTimes.push(processingTimeMs);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
    this.metrics.avgProcessingTimeMs =
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * Register shutdown handlers for graceful shutdown
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Hook for cleanup on shutdown
   */
  protected async onShutdown(): Promise<void> {
    // Override in subclasses for custom cleanup
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = this.config.retryDelayMs * Math.pow(2, attempt);

        this.logger.warn(`${context} failed, retrying`, {
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          delayMs: delay,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${context} failed after ${this.config.maxRetries} attempts`);
  }
}
