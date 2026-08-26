import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectBillingTransitionRepositoryLike } from "../project-billing-transition-service";
import { ProjectBillingTransitionService } from "../project-billing-transition-service";

vi.mock("@glapi/database", () => ({
  ProjectBillingTransitionRepository: class {},
  ProjectBillingTransitionError: class ProjectBillingTransitionError extends Error {},
}));

const organizationId = "00000000-0000-4000-8000-000000000001";
const actorId = "00000000-0000-4000-8000-000000000002";
const invoiceId = "00000000-0000-4000-8000-000000000003";

describe("ProjectBillingTransitionService", () => {
  let repository: ProjectBillingTransitionRepositoryLike;
  let transition: ReturnType<typeof vi.fn>;
  let service: ProjectBillingTransitionService;

  beforeEach(() => {
    transition = vi.fn().mockResolvedValue({
      replayed: false,
      action: "rebill",
      originalInvoiceId: invoiceId,
      replacementInvoiceId: "00000000-0000-4000-8000-000000000004",
      releasedAllocationIds: ["allocation-original"],
      replacementAllocationIds: ["allocation-replacement"],
    });
    repository = {
      listHistory: vi.fn().mockResolvedValue([]),
      transition,
    };
    service = new ProjectBillingTransitionService(
      { organizationId, userId: actorId },
      { repository },
    );
  });

  it("creates a stable audited rebill command", async () => {
    const result = await service.transition({
      invoiceId,
      action: "rebill",
      reason: " Customer requested corrected grouping ",
      idempotencyKey: "rebill-001",
      invoiceDate: "2026-08-26",
    });

    expect(result.replacementInvoiceId).toBeTruthy();
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorId,
        invoiceId,
        action: "rebill",
        reason: "Customer requested corrected grouping",
        idempotencyKey: "rebill-001",
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("uses the same request hash for an exact replay", async () => {
    const input = {
      invoiceId,
      action: "void" as const,
      reason: "Duplicate customer invoice",
      idempotencyKey: "void-001",
    };
    await service.transition(input);
    await service.transition(input);

    expect(transition.mock.calls[0][0].requestHash).toBe(
      transition.mock.calls[1][0].requestHash,
    );
  });

  it("scopes history to the current organization", async () => {
    await service.listHistory("billed");
    expect(repository.listHistory).toHaveBeenCalledWith(
      organizationId,
      "billed",
    );
  });
});
