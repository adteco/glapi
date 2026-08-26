import { describe, expect, it, vi } from "vitest";

vi.mock("@glapi/database", () => ({
  ProjectRevenueRecognitionReversalRepository: vi.fn(),
  ProjectRevenueRecognitionReversalError: class extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

import {
  ProjectRevenueRecognitionReversalService,
  type ProjectRevenueRecognitionReversalRepositoryLike,
} from "../project-revenue-recognition-reversal-service";

describe("ProjectRevenueRecognitionReversalService", () => {
  const request = {
    subsidiaryId: "subsidiary-1",
    originalRunId: "run-1",
    accountingPeriodId: "period-2",
    reversalDate: "2026-09-01",
    reason: "Correct project progress input",
  };

  it("creates a stable hashed, actor-attributed reversal request", async () => {
    const execute = vi.fn().mockResolvedValue({
      replayed: false,
      reversal: { id: "reversal-1", totalReversedAmount: "48600.35" },
      items: [{ originalRunItemId: "item-1", reversedAmount: "48600.35" }],
      glTransaction: { id: "gl-reversal-1", transactionType: "REVERSAL" },
    });
    const service = new ProjectRevenueRecognitionReversalService(
      { organizationId: "org-1", userId: "user-1" },
      {
        repository: {
          execute,
        } as ProjectRevenueRecognitionReversalRepositoryLike,
      },
    );

    await expect(
      service.reverseRun(request, "reverse-key-1"),
    ).resolves.toMatchObject({
      replayed: false,
      reversal: { totalReversedAmount: "48600.35" },
      glTransaction: { transactionType: "REVERSAL" },
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        originalRunId: "run-1",
        approvedBy: "user-1",
        workerActor: "project-revenue-recognition-reversal-service",
        idempotencyKey: "reverse-key-1",
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("requires an idempotency key before persistence", async () => {
    const execute = vi.fn();
    const service = new ProjectRevenueRecognitionReversalService(
      { organizationId: "org-1" },
      {
        repository: {
          execute,
        } as ProjectRevenueRecognitionReversalRepositoryLike,
      },
    );
    await expect(service.reverseRun(request, " ")).rejects.toMatchObject({
      code: "PROJECT_REVENUE_REVERSAL_IDEMPOTENCY_REQUIRED",
      statusCode: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
