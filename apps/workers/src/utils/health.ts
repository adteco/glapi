export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, HealthCheck>;
  timestamp: string;
  uptime: number;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  timestamp: string;
}

const startTime = Date.now();

// Health check registry
const healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();

/**
 * Register a health check function
 */
export function registerHealthCheck(
  name: string,
  check: () => Promise<HealthCheck>
): void {
  healthChecks.set(name, check);
}

/**
 * Run all health checks and return aggregated status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: Record<string, HealthCheck> = {};
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  for (const [name, checkFn] of healthChecks) {
    try {
      const result = await checkFn();
      checks[name] = result;

      if (result.status === 'fail') {
        overallStatus = 'unhealthy';
      } else if (result.status === 'warn' && overallStatus !== 'unhealthy') {
        overallStatus = 'degraded';
      }
    } catch (error) {
      checks[name] = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      overallStatus = 'unhealthy';
    }
  }

  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    uptime: (Date.now() - startTime) / 1000,
  };
}

/**
 * Simple liveness check (is the process running?)
 */
export function getLivenessStatus(): { status: 'ok'; timestamp: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
