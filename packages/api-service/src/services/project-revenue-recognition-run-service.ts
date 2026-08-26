import { createHash } from 'node:crypto';
import {
  ProjectRevenueRecognitionRunError,
  ProjectRevenueRecognitionRunRepository,
  type ContextualDatabase,
  type ProjectRevenueRecognitionRunInput,
  type ProjectRevenueRecognitionPreview,
  type ProjectRevenueRecognitionReceipt,
} from '@glapi/database';
import { ServiceError } from '../types';
import { BaseService } from './base-service';

export interface ProjectRevenueRecognitionRunRepositoryLike {
  preview(input: ProjectRevenueRecognitionRunInput): Promise<ProjectRevenueRecognitionPreview>;
  execute(input: ProjectRevenueRecognitionRunInput): Promise<ProjectRevenueRecognitionReceipt>;
}

export interface ProjectRevenueRecognitionRunServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectRevenueRecognitionRunRepositoryLike;
}

export interface ProjectRevenueRecognitionRunRequest {
  subsidiaryId: string;
  accountingPeriodId: string;
  recognitionDate: string;
  scheduleIds?: string[];
}

function cents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

function canonicalRequest(request: ProjectRevenueRecognitionRunRequest) {
  return {
    subsidiaryId: request.subsidiaryId,
    accountingPeriodId: request.accountingPeriodId,
    recognitionDate: request.recognitionDate,
    scheduleIds: request.scheduleIds ? [...new Set(request.scheduleIds)].sort() : null,
  };
}

function requestHash(request: ProjectRevenueRecognitionRunRequest): string {
  return createHash('sha256').update(JSON.stringify(canonicalRequest(request))).digest('hex');
}

export class ProjectRevenueRecognitionRunService extends BaseService {
  private readonly repository: ProjectRevenueRecognitionRunRepositoryLike;

  constructor(context = {}, options: ProjectRevenueRecognitionRunServiceOptions = {}) {
    super(context);
    this.repository =
      options.repository ?? new ProjectRevenueRecognitionRunRepository(options.db);
  }

  private input(
    request: ProjectRevenueRecognitionRunRequest,
    idempotencyKey: string,
  ): ProjectRevenueRecognitionRunInput {
    return {
      organizationId: this.requireOrganizationContext(),
      ...canonicalRequest(request),
      scheduleIds: canonicalRequest(request).scheduleIds ?? undefined,
      idempotencyKey,
      requestHash: requestHash(request),
      initiatedBy: this.context.userId,
    };
  }

  private translate(error: unknown): never {
    if (!(error instanceof ProjectRevenueRecognitionRunError)) throw error;
    const statusCode =
      error.code === 'REVENUE_RECOGNITION_PERIOD_NOT_FOUND'
        ? 404
        : error.code === 'REVENUE_RECOGNITION_DATE_OUTSIDE_PERIOD'
          ? 422
          : 409;
    throw new ServiceError(error.message, error.code, statusCode);
  }

  async previewRun(request: ProjectRevenueRecognitionRunRequest) {
    try {
      const preview = await this.repository.preview(this.input(request, 'dry-run'));
      const total = preview.schedules.reduce(
        (sum, schedule) => sum + cents(schedule.scheduledAmount),
        0n,
      );
      return {
        dryRun: true,
        accountingPeriod: preview.accountingPeriod,
        scheduleCount: preview.schedules.length,
        totalRecognizedAmount: formatCents(total),
        schedules: preview.schedules,
      };
    } catch (error) {
      return this.translate(error);
    }
  }

  async executeRun(request: ProjectRevenueRecognitionRunRequest, idempotencyKey: string) {
    if (!idempotencyKey.trim()) {
      throw new ServiceError(
        'An idempotency key is required for revenue recognition',
        'REVENUE_RECOGNITION_IDEMPOTENCY_REQUIRED',
        400,
      );
    }
    try {
      const receipt = await this.repository.execute(this.input(request, idempotencyKey));
      return {
        replayed: receipt.replayed,
        run: receipt.run,
        scheduleCount: receipt.run.scheduleCount,
        totalRecognizedAmount: receipt.run.totalRecognizedAmount,
        items: receipt.items,
      };
    } catch (error) {
      return this.translate(error);
    }
  }
}
