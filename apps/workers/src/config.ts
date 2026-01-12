import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface OutboxProcessorConfig {
  /** How often to poll for pending events (ms) */
  pollIntervalMs: number;
  /** Number of events to process per batch */
  batchSize: number;
  /** How long to lock events during processing (ms) */
  lockDurationMs: number;
  /** Maximum retry attempts before giving up */
  maxRetries: number;
  /** Initial retry delay (ms) */
  initialRetryDelayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Maximum retry delay (ms) */
  maxRetryDelayMs: number;
}

export interface ServerConfig {
  /** Port for health/metrics HTTP server */
  port: number;
  /** Host to bind to */
  host: string;
}

export interface Config {
  /** Environment name */
  env: string;
  /** Log level */
  logLevel: string;
  /** Database connection string */
  databaseUrl: string;
  /** Outbox processor settings */
  outbox: OutboxProcessorConfig;
  /** HTTP server settings */
  server: ServerConfig;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function loadConfig(): Config {
  return {
    env: getEnvOrDefault('NODE_ENV', 'development'),
    logLevel: getEnvOrDefault('LOG_LEVEL', 'info'),
    databaseUrl: getEnvOrDefault('DATABASE_URL', ''),

    outbox: {
      pollIntervalMs: getEnvInt('OUTBOX_POLL_INTERVAL_MS', 1000),
      batchSize: getEnvInt('OUTBOX_BATCH_SIZE', 100),
      lockDurationMs: getEnvInt('OUTBOX_LOCK_DURATION_MS', 30000),
      maxRetries: getEnvInt('OUTBOX_MAX_RETRIES', 5),
      initialRetryDelayMs: getEnvInt('OUTBOX_INITIAL_RETRY_DELAY_MS', 1000),
      backoffMultiplier: getEnvInt('OUTBOX_BACKOFF_MULTIPLIER', 2),
      maxRetryDelayMs: getEnvInt('OUTBOX_MAX_RETRY_DELAY_MS', 300000),
    },

    server: {
      port: getEnvInt('METRICS_PORT', 9090),
      host: getEnvOrDefault('METRICS_HOST', '0.0.0.0'),
    },
  };
}

export const config = loadConfig();
