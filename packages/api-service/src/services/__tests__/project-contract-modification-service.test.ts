import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@glapi/database", () => ({
  ProjectContractModificationRepository: vi.fn(),
  ProjectContractModificationRepositoryError: class extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@glapi/business", async () => ({
  ...(await import(
    "../../../../business/src/services/project-revenue-plan-engine"
  )),
  ...(await import(
    "../../../../business/src/services/project-contract-modification-engine"
  )),
  ...(await import(
    "../../../../business/src/services/project-contract-position-posting-engine"
  )),
}));

import {
  ProjectContractModificationService,
  type ProjectContractModificationRepositoryLike,
} from "../project-contract-modification-service";

describe("ProjectContractModificationService", () => {
  let findSource: ReturnType<typeof vi.fn>;
  let findReceipt: ReturnType<typeof vi.fn>;
  let apply: ReturnType<typeof vi.fn>;
  let service: ProjectContractModificationService;

  beforeEach(() => {
    findReceipt = vi.fn().mockResolvedValue(null);
    findSource = vi.fn().mockResolvedValue({
      projectContractId: "contract-1",
      priorVersionId: "version-1",
      revisedVersionId: "version-2",
      priorAllocatedAmount: "100000.00",
      priorRecognizedAmount: "25000.00",
      priorBilledAmount: "0.00",
      exchangeRate: "1.000000",
      revisedPlanSource: {
        projectContractId: "contract-1",
        projectContractVersionId: "version-2",
        transactionPrice: "110000.00",
        variableConsideration: "0",
        currencyCode: "USD",
        contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31",
        lines: [
          {
            id: "line-2",
            itemId: null,
            description: "Implementation",
            transactionPrice: "110000.00",
            sspAmount: "110000.00",
            fallbackSspAmount: null,
            revenueTiming: "over_time",
            recognitionMethod: "cost_to_cost",
            serviceStartDate: "2026-01-01",
            serviceEndDate: "2026-12-31",
          },
        ],
      },
    });
    apply = vi.fn().mockImplementation(async (input) => ({
      replayed: false,
      modification: {
        id: "modification-1",
        catchUpAdjustment: input.catchUpAdjustment,
      },
      supersededScheduleIds: ["schedule-future"],
    }));
    service = new ProjectContractModificationService(
      { organizationId: "org-1", userId: "user-1" },
      {
        repository: {
          findReceipt,
          findSource,
          apply,
        } as ProjectContractModificationRepositoryLike,
      },
    );
  });

  const request = {
    priorVersionId: "version-1",
    revisedVersionId: "version-2",
    method: "cumulative_catch_up" as const,
    effectiveDate: "2026-08-01",
    progressPercentage: "20",
    reason: "Approved scope reduction",
  };

  it("previews the G006 negative catch-up and remaining allocation", async () => {
    await expect(service.previewModification(request)).resolves.toMatchObject({
      dryRun: true,
      classification: "cumulative_catch_up",
      calculation: {
        revisedCumulativeRevenue: "22000.00",
        catchUpAdjustment: "-3000.00",
        remainingAllocation: "88000.00",
      },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("applies a recast plan and signed catch-up through one repository call", async () => {
    const result = await service.applyModification(request, "mod-key-1");

    expect(result).toMatchObject({
      replayed: false,
      modification: { catchUpAdjustment: "-3000.00" },
      supersededScheduleIds: ["schedule-future"],
    });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        priorAllocatedAmount: "100000.00",
        revisedAllocatedAmount: "110000.00",
        catchUpAdjustment: "-3000.00",
        remainingAllocation: "88000.00",
        idempotencyKey: "mod-key-1",
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        catchUpPosting: {
          lines: [
            expect.objectContaining({
              accountRole: "contract_asset",
              creditAmount: "3000.00",
            }),
            expect.objectContaining({
              accountRole: "revenue",
              debitAmount: "3000.00",
            }),
          ],
          totalBaseAmount: "3000.0000",
        },
      }),
    );
  });

  it("classifies a separate contract without mutating the current version", async () => {
    const preview = await service.previewModification({
      ...request,
      method: "separate_contract",
    });
    expect(preview).toMatchObject({
      classification: "separate_contract",
      requiresSeparateContract: true,
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("replays the receipt without requiring the superseded source to remain eligible", async () => {
    await service.applyModification(request, "mod-key-1");
    const requestHash = apply.mock.calls[0][0].requestHash;
    findReceipt.mockResolvedValue({
      replayed: true,
      modification: { id: "modification-1", requestHash },
      supersededScheduleIds: ["schedule-future"],
    });

    await expect(
      service.applyModification(request, "mod-key-1"),
    ).resolves.toMatchObject({
      replayed: true,
      modification: { id: "modification-1" },
    });
    expect(findSource).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
