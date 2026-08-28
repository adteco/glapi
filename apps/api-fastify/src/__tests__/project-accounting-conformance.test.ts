import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("@glapi/database", () => ({ db: {} }));
vi.mock("@glapi/api-service", () => ({
  ProjectBillingQueueService: class {},
  ProjectBillingTransitionService: class {},
  ProjectContractModificationService: class {},
  ProjectRevenueGlPostingService: class {},
  ProjectRevenuePlanService: class {},
  ProjectRevenueRecognitionReversalService: class {},
  ProjectRevenueRecognitionRunService: class {},
  ServiceError: class ServiceError extends Error {},
}));

import {
  registerProjectAccountingRoutes,
  type ProjectAccountingServices,
} from "../project-accounting-routes";

type Receipt = { hash: string; result: Record<string, unknown> };

function conformanceHarness() {
  const activeSources = new Map<string, string>();
  const receipts = new Map<string, Receipt>();
  const recognitionEvents = new Map<string, string>();
  const allocations = new Map<
    string,
    { id: string; status: "active" | "released"; replacedBy: string | null }
  >();
  let invoiceSequence = 0;
  let recognitionSequence = 0;

  const replay = (
    organizationId: string,
    key: string,
    input: unknown,
    create: () => Record<string, unknown>,
  ) => {
    const receiptKey = `${organizationId}:${key}`;
    const hash = JSON.stringify(input);
    const prior = receipts.get(receiptKey);
    if (prior) {
      if (prior.hash !== hash) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return { ...prior.result, replayed: true };
    }
    const result = create();
    receipts.set(receiptKey, { hash, result });
    return { ...result, replayed: false };
  };

  const services: ProjectAccountingServices = {
    billing: (context) => ({
      listCandidates: async () =>
        ({
          data: activeSources.has(`${context.organizationId}:time-1`)
            ? []
            : [{ candidateId: "TIME_ENTRY:time-1" }],
          total: activeSources.has(`${context.organizationId}:time-1`) ? 0 : 1,
        }) as never,
      previewInvoiceDrafts: async () =>
        ({ draftCount: 1, grandTotal: "1500.00" }) as never,
      createInvoiceDrafts: async (input) =>
        replay(context.organizationId, input.idempotencyKey, input, () => {
          const sourceKey = `${context.organizationId}:time-1`;
          if (activeSources.has(sourceKey))
            throw new Error("BILLING_SOURCE_CONFLICT");
          const invoiceId = `invoice-${++invoiceSequence}`;
          const allocationId = `allocation-${invoiceSequence}`;
          activeSources.set(sourceKey, allocationId);
          allocations.set(allocationId, {
            id: allocationId,
            status: "active",
            replacedBy: null,
          });
          return { invoices: [{ invoiceId, totalAmount: "1500.00" }] };
        }) as never,
    }),
    billingTransitions: (context) => ({
      listHistory: async () => [...allocations.values()] as never,
      transition: async (input) =>
        replay(context.organizationId, input.idempotencyKey, input, () => {
          const sourceKey = `${context.organizationId}:time-1`;
          const originalId = activeSources.get(sourceKey)!;
          const original = allocations.get(originalId)!;
          original.status = "released";
          const replacementId = `allocation-${++invoiceSequence}`;
          original.replacedBy = replacementId;
          allocations.set(replacementId, {
            id: replacementId,
            status: "active",
            replacedBy: null,
          });
          activeSources.set(sourceKey, replacementId);
          return {
            originalInvoiceId: input.invoiceId,
            replacementInvoiceId: `invoice-${invoiceSequence}`,
          };
        }) as never,
    }),
    plans: () => ({
      previewPlan: async () =>
        ({ totalAllocated: "12000.00", scheduleCount: 12 }) as never,
      generatePlan: async () =>
        ({ totalAllocated: "12000.00", scheduleCount: 12 }) as never,
      getPlan: async () =>
        ({ totalAllocated: "12000.00", scheduleCount: 12 }) as never,
    }),
    recognition: (context) => ({
      previewRun: async () => ({ total: "1000.00" }) as never,
      executeRun: async (input, key) =>
        replay(context.organizationId, key, input, () => {
          const scheduleKey = `${context.organizationId}:schedule-1`;
          if (recognitionEvents.has(scheduleKey))
            throw new Error("RECOGNITION_SOURCE_CONFLICT");
          const runId = `run-${++recognitionSequence}`;
          recognitionEvents.set(scheduleKey, runId);
          return { run: { id: runId }, totalRecognized: "1000.00" };
        }) as never,
    }),
    posting: () => ({
      postRecognitionRun: async (runId) =>
        ({
          runId,
          totalDebitAmount: "1000.00",
          totalCreditAmount: "1000.00",
        }) as never,
      postProjectInvoice: async (invoiceId) =>
        ({
          invoiceId,
          totalDebitAmount: "1500.00",
          totalCreditAmount: "1500.00",
        }) as never,
    }),
    modifications: () => ({
      previewModification: async () => ({ catchUpAmount: "-3000.00" }) as never,
      applyModification: async () =>
        ({
          cumulativeRevenue: "22000.00",
          remainingAllocation: "88000.00",
        }) as never,
    }),
    reversals: () => ({
      reverseRun: async () =>
        ({
          totalDebitAmount: "1000.00",
          totalCreditAmount: "1000.00",
          cumulativeRevenue: "0.00",
        }) as never,
    }),
  };
  return { activeSources, allocations, recognitionEvents, services };
}

async function createServer(harness: ReturnType<typeof conformanceHarness>) {
  const server = Fastify();
  await server.register(registerProjectAccountingRoutes, {
    resolveUser: async (request) => ({
      organizationId: String(request.headers["x-test-organization"]),
      entityId: "00000000-0000-4000-8000-000000000001",
    }),
    services: harness.services,
  });
  return server;
}

describe("project accounting production-path conformance", () => {
  it("keeps tenant-scoped billing idempotent under concurrent REST requests", async () => {
    const harness = conformanceHarness();
    const server = await createServer(harness);
    const request = {
      method: "POST" as const,
      url: "/v1/project-billing/drafts",
      headers: { "x-test-organization": "org-a", "idempotency-key": "bill-1" },
      payload: {
        candidateIds: ["TIME_ENTRY:time-1"],
        invoiceDate: "2026-01-31",
      },
    };
    const [first, replay] = await Promise.all([
      server.inject(request),
      server.inject(request),
    ]);
    const otherTenant = await server.inject({
      method: "GET",
      url: "/v1/project-billing/candidates",
      headers: { "x-test-organization": "org-b" },
    });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(first.json().invoices[0].invoiceId).toBe(
      replay.json().invoices[0].invoiceId,
    );
    expect([first.json().replayed, replay.json().replayed].sort()).toEqual([
      false,
      true,
    ]);
    expect(otherTenant.json().total).toBe(1);
    expect([...harness.activeSources.keys()]).toEqual(["org-a:time-1"]);
  });

  it("preserves G-007 lineage with exactly one active allocation after rebill replay", async () => {
    const harness = conformanceHarness();
    const server = await createServer(harness);
    const headers = {
      "x-test-organization": "org-a",
      "idempotency-key": "bill-1",
    };
    const billed = await server.inject({
      method: "POST",
      url: "/v1/project-billing/drafts",
      headers,
      payload: {
        candidateIds: ["TIME_ENTRY:time-1"],
        invoiceDate: "2026-01-31",
      },
    });
    const invoiceId = billed.json().invoices[0].invoiceId;
    const rebillRequest = {
      method: "POST" as const,
      url: `/v1/project-billing/invoices/${invoiceId}/transitions`,
      headers: {
        "x-test-organization": "org-a",
        "idempotency-key": "rebill-1",
      },
      payload: {
        action: "rebill",
        reason: "Correct grouping",
        invoiceDate: "2026-01-31",
      },
    };
    const first = await server.inject(rebillRequest);
    const replay = await server.inject(rebillRequest);
    const rows = [...harness.allocations.values()];

    expect(first.json().replacementInvoiceId).toBe(
      replay.json().replacementInvoiceId,
    );
    expect(rows.filter((row) => row.status === "active")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "released")).toHaveLength(1);
    expect(rows.find((row) => row.status === "released")?.replacedBy).toBe(
      rows.find((row) => row.status === "active")?.id,
    );
  });

  it("runs fixed-fee recognition, balanced posting, modification, and reversal through REST", async () => {
    const harness = conformanceHarness();
    const server = await createServer(harness);
    const headers = {
      "x-test-organization": "org-a",
      "idempotency-key": "command-1",
    };
    const plan = await server.inject({
      method: "POST",
      url: "/v1/project-revenue/plans/version-1",
      headers,
    });
    const run = await server.inject({
      method: "POST",
      url: "/v1/project-revenue/recognition-runs",
      headers,
      payload: { scheduleIds: ["schedule-1"] },
    });
    const posted = await server.inject({
      method: "POST",
      url: `/v1/project-revenue/recognition-runs/${run.json().run.id}/post`,
      headers,
    });
    const modification = await server.inject({
      method: "POST",
      url: "/v1/project-revenue/modifications",
      headers,
      payload: { method: "cumulative_catch_up" },
    });
    const reversal = await server.inject({
      method: "POST",
      url: "/v1/project-revenue/recognition-reversals",
      headers,
      payload: { originalRunId: run.json().run.id },
    });

    expect(plan.json()).toMatchObject({
      totalAllocated: "12000.00",
      scheduleCount: 12,
    });
    expect(posted.json().totalDebitAmount).toBe(
      posted.json().totalCreditAmount,
    );
    expect(modification.json()).toMatchObject({
      cumulativeRevenue: "22000.00",
      remainingAllocation: "88000.00",
    });
    expect(reversal.json()).toMatchObject({
      totalDebitAmount: "1000.00",
      totalCreditAmount: "1000.00",
      cumulativeRevenue: "0.00",
    });
    expect(harness.recognitionEvents.size).toBe(1);
  });
});
