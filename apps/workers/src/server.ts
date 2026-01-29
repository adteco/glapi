import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getMetrics, getMetricsContentType } from './utils/metrics';
import { getHealthStatus, getLivenessStatus } from './utils/health';
import { createChildLogger } from './utils/logger';
import { config } from './config';

const logger = createChildLogger('HttpServer');

/**
 * Simple HTTP server for health checks and Prometheus metrics
 */
export function createHttpServer() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    try {
      switch (url.pathname) {
        case '/health':
        case '/healthz':
          await handleHealth(res);
          break;

        case '/ready':
        case '/readyz':
          await handleReadiness(res);
          break;

        case '/live':
        case '/livez':
          handleLiveness(res);
          break;

        case '/metrics':
          await handleMetrics(res);
          break;

        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      logger.error({ error, path: url.pathname }, 'Request handler error');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  return server;
}

/**
 * Health endpoint - aggregated health status
 */
async function handleHealth(res: ServerResponse): Promise<void> {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health, null, 2));
}

/**
 * Readiness endpoint - is the service ready to accept traffic?
 */
async function handleReadiness(res: ServerResponse): Promise<void> {
  const health = await getHealthStatus();
  const ready = health.status !== 'unhealthy';

  res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ready, ...health }));
}

/**
 * Liveness endpoint - is the process alive?
 */
function handleLiveness(res: ServerResponse): void {
  const status = getLivenessStatus();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status));
}

/**
 * Metrics endpoint - Prometheus format
 */
async function handleMetrics(res: ServerResponse): Promise<void> {
  const metrics = await getMetrics();
  res.writeHead(200, { 'Content-Type': getMetricsContentType() });
  res.end(metrics);
}

/**
 * Start the HTTP server
 */
export function startHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer();

    server.on('error', (error) => {
      logger.error({ error }, 'HTTP server error');
      reject(error);
    });

    server.listen(config.server.port, config.server.host, () => {
      logger.info(
        { port: config.server.port, host: config.server.host },
        'HTTP server started'
      );
      resolve();
    });
  });
}
