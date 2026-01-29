import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'glapi-workers',
  },
});

export type Logger = typeof logger;

export function createChildLogger(name: string): Logger {
  return logger.child({ component: name });
}
