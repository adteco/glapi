import { NextRequest, NextResponse } from 'next/server';
import { getServiceContext } from '../../utils/auth';
import { isServiceError } from '../../utils/errors';
import { db, eventProjections, eventStore, sql, desc } from '@glapi/database';

// Force dynamic rendering since this route uses headers
export const dynamic = 'force-dynamic';

interface ProjectionStatus {
  projectionName: string;
  lastProcessedSequence: number;
  currentGlobalSequence: number;
  lag: number;
  lastUpdated: string;
  status: 'healthy' | 'warning' | 'error';
  errorCount: number;
  lastError?: string;
}

interface ProjectionMetrics {
  totalEventsProcessed: number;
  eventsProcessedPerSecond: number;
  averageProcessingTime: number;
  uptime: string;
}

/**
 * GET /api/admin/projections
 *
 * Get projection status and metrics for the monitoring dashboard.
 * Returns status of all projection workers and system metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getServiceContext();

    // Get current global sequence
    const sequenceResult = await db
      .select({
        maxSequence: sql<string>`COALESCE(MAX(${eventStore.globalSequence}), 0)`,
      })
      .from(eventStore);

    const currentGlobalSequence = parseInt(sequenceResult[0]?.maxSequence ?? '0', 10);

    // Get projection checkpoints
    const projectionCheckpoints = await db
      .select()
      .from(eventProjections)
      .orderBy(desc(eventProjections.updatedAt));

    // Build projection status list
    const projections: ProjectionStatus[] = projectionCheckpoints.map((checkpoint) => {
      const lastProcessedSequence = checkpoint.lastGlobalSequence ?? 0;
      const lag = currentGlobalSequence - lastProcessedSequence;

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      if (lag > 1000) {
        status = 'error';
      } else if (lag > 100) {
        status = 'warning';
      }

      return {
        projectionName: checkpoint.projectionName,
        lastProcessedSequence,
        currentGlobalSequence,
        lag,
        lastUpdated: checkpoint.updatedAt?.toISOString() ?? new Date().toISOString(),
        status,
        errorCount: 0, // TODO: Track error counts in projection table
        lastError: undefined,
      };
    });

    // Add default projections if not in database yet
    const defaultProjections = ['gl-account-balance', 'outbox-processor'];
    for (const projName of defaultProjections) {
      if (!projections.find((p) => p.projectionName === projName)) {
        projections.push({
          projectionName: projName,
          lastProcessedSequence: 0,
          currentGlobalSequence,
          lag: currentGlobalSequence,
          lastUpdated: new Date().toISOString(),
          status: currentGlobalSequence === 0 ? 'healthy' : 'warning',
          errorCount: 0,
        });
      }
    }

    // Calculate metrics
    const totalEvents = await db
      .select({
        count: sql<string>`COUNT(*)`,
      })
      .from(eventStore);

    const totalEventsProcessed = parseInt(totalEvents[0]?.count ?? '0', 10);

    const metrics: ProjectionMetrics = {
      totalEventsProcessed,
      eventsProcessedPerSecond: 0, // Would require time-series data to calculate
      averageProcessingTime: 0, // Would require tracking processing times
      uptime: 'N/A', // Would require worker health endpoints
    };

    return NextResponse.json({
      projections,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting projection status:', error);

    if (isServiceError(error)) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
