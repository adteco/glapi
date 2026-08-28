import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@glapi/database', () => ({
  ProjectRevenueRecognitionRunRepository: vi.fn(),
  ProjectRevenueRecognitionRunError: class ProjectRevenueRecognitionRunError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

import {
  ProjectRevenueRecognitionRunError,
  type ProjectRevenueRecognitionPreview,
  type ProjectRevenueRecognitionReceipt,
} from '@glapi/database';
import {
  ProjectRevenueRecognitionRunService,
  type ProjectRevenueRecognitionRunRepositoryLike,
} from '../project-revenue-recognition-run-service';

describe('ProjectRevenueRecognitionRunService', () => {
  let preview: ReturnType<typeof vi.fn>;
  let execute: ReturnType<typeof vi.fn>;
  let service: ProjectRevenueRecognitionRunService;

  beforeEach(() => {
    preview = vi.fn().mockResolvedValue({
      accountingPeriod: {
        id: 'period-1',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'OPEN',
      },
      schedules: [
        {
          id: 'schedule-1',
          projectContractVersionId: 'version-1',
          performanceObligationId: 'obligation-1',
          scheduleDate: '2026-08-15',
          scheduledAmount: '43200.25',
        },
        {
          id: 'schedule-2',
          projectContractVersionId: 'version-1',
          performanceObligationId: 'obligation-2',
          scheduleDate: '2026-08-31',
          scheduledAmount: '5400.10',
        },
      ],
    } satisfies ProjectRevenueRecognitionPreview);
    execute = vi.fn().mockResolvedValue({
      replayed: false,
      run: {
        id: 'run-1',
        scheduleCount: 2,
        totalRecognizedAmount: '48600.35',
      },
      items: [],
    } as unknown as ProjectRevenueRecognitionReceipt);
    service = new ProjectRevenueRecognitionRunService(
      { organizationId: 'org-1', userId: 'user-1' },
      {
        repository: { preview, execute } as ProjectRevenueRecognitionRunRepositoryLike,
      },
    );
  });

  const request = {
    subsidiaryId: 'subsidiary-1',
    accountingPeriodId: 'period-1',
    recognitionDate: '2026-08-31',
    scheduleIds: ['schedule-2', 'schedule-1', 'schedule-2'],
  };

  it('previews exact reconciled totals without executing a run', async () => {
    const result = await service.previewRun(request);

    expect(result).toMatchObject({
      dryRun: true,
      scheduleCount: 2,
      totalRecognizedAmount: '48600.35',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        scheduleIds: ['schedule-1', 'schedule-2'],
      }),
    );
  });

  it('builds the same request hash regardless of schedule selection order', async () => {
    await service.executeRun(request, 'run-key-1');
    await service.executeRun(
      { ...request, scheduleIds: ['schedule-1', 'schedule-2'] },
      'run-key-2',
    );

    expect(execute.mock.calls[0][0].requestHash).toBe(execute.mock.calls[1][0].requestHash);
    expect(execute.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      initiatedBy: 'user-1',
      idempotencyKey: 'run-key-1',
    });
  });

  it('returns the immutable repository receipt and replay marker', async () => {
    execute.mockResolvedValue({
      replayed: true,
      run: {
        id: 'run-1',
        scheduleCount: 2,
        totalRecognizedAmount: '48600.35',
      },
      items: [{ revenueScheduleId: 'schedule-1' }],
    });

    const result = await service.executeRun(request, 'run-key-1');

    expect(result).toMatchObject({
      replayed: true,
      scheduleCount: 2,
      totalRecognizedAmount: '48600.35',
      items: [{ revenueScheduleId: 'schedule-1' }],
    });
  });

  it('rejects a missing idempotency key before touching persistence', async () => {
    await expect(service.executeRun(request, ' ')).rejects.toMatchObject({
      code: 'REVENUE_RECOGNITION_IDEMPOTENCY_REQUIRED',
      statusCode: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps a closed-period rejection to a conflict response', async () => {
    preview.mockRejectedValue(
      new ProjectRevenueRecognitionRunError(
        'REVENUE_RECOGNITION_PERIOD_CLOSED' as never,
        'Period is closed',
      ),
    );

    await expect(service.previewRun(request)).rejects.toMatchObject({
      code: 'REVENUE_RECOGNITION_PERIOD_CLOSED',
      statusCode: 409,
    });
  });
});
