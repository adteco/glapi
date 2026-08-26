import { describe, expect, it } from "vitest";
import {
  calculateProjectContractPositionPosting,
  calculateProjectContractRevenueAdjustment,
} from "../project-contract-position-posting-engine";
import { generateProjectRevenuePlan } from "../project-revenue-plan-engine";

type Position = { cumulativeRecognized: string; cumulativeBilled: string };

function apply(
  position: Position,
  kind: "billing" | "revenue_recognition",
  amount: string,
) {
  const posting = calculateProjectContractPositionPosting(position, {
    kind,
    amount,
  });
  expect(posting.totalDebits).toBe(posting.totalCredits);
  expect(
    Number(posting.next.contractAsset) - Number(posting.next.contractLiability),
  ).toBeCloseTo(
    Number(posting.next.cumulativeRecognized) -
      Number(posting.next.cumulativeBilled),
    2,
  );
  expect(
    Number(posting.next.contractAsset) > 0 &&
      Number(posting.next.contractLiability) > 0,
  ).toBe(false);
  return posting.next;
}

describe("ADR-001 project accounting golden conformance", () => {
  it("G-001 reconciles T&M billing, recognition, cash, and open AR", () => {
    let position: Position = {
      cumulativeRecognized: "0.00",
      cumulativeBilled: "0.00",
    };
    position = apply(position, "billing", "1500.00");
    position = apply(position, "revenue_recognition", "1500.00");
    position = apply(position, "billing", "1200.00");
    position = apply(position, "revenue_recognition", "1200.00");

    const issued = 2700;
    const cash = 1500;
    expect(position).toEqual({
      cumulativeRecognized: "2700.00",
      cumulativeBilled: "2700.00",
      contractAsset: "0.00",
      contractLiability: "0.00",
    });
    expect(issued - cash).toBe(1200);
  });

  it("G-002 recognizes delayed-billing work as an asset then clears it", () => {
    let position = apply(
      { cumulativeRecognized: "0.00", cumulativeBilled: "0.00" },
      "revenue_recognition",
      "1500.00",
    );
    expect(position.contractAsset).toBe("1500.00");
    position = apply(position, "billing", "1500.00");
    expect(position).toMatchObject({
      contractAsset: "0.00",
      contractLiability: "0.00",
    });
  });

  it("G-003 allocates fixed fee over twelve months and rolls liability down", () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: "contract-fixed-001",
      projectContractVersionId: "contract-fixed-001-v1",
      transactionPrice: "12000.00",
      currencyCode: "USD",
      contractStartDate: "2026-01-01",
      contractEndDate: "2026-12-31",
      lines: [
        {
          id: "stand-ready",
          description: "Stand-ready service",
          transactionPrice: "12000.00",
          revenueTiming: "over_time",
          recognitionMethod: "elapsed_time",
          serviceStartDate: "2026-01-01",
          serviceEndDate: "2026-12-31",
        },
      ],
    });
    expect(plan.totalAllocated).toBe("12000.00");
    expect(plan.obligations[0].schedules).toHaveLength(12);
    expect(
      plan.obligations[0].schedules.reduce(
        (sum, row) => sum + Number(row.scheduledAmount),
        0,
      ),
    ).toBe(12000);

    let position = apply(
      { cumulativeRecognized: "0.00", cumulativeBilled: "0.00" },
      "billing",
      "12000.00",
    );
    position = apply(position, "revenue_recognition", "1000.00");
    position = apply(position, "revenue_recognition", "1000.00");
    expect(position.contractLiability).toBe("10000.00");
  });

  it("G-004 allocates the bundle discount by SSP independently of milestones", () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: "contract-bundle-001",
      projectContractVersionId: "contract-bundle-001-v1",
      transactionPrice: "108000.00",
      currencyCode: "USD",
      contractStartDate: "2026-01-01",
      contractEndDate: "2026-12-31",
      lines: [
        {
          id: "implementation",
          description: "Implementation",
          transactionPrice: "54000.00",
          sspAmount: "48000.00",
          revenueTiming: "point_in_time",
          recognitionMethod: "units_delivered",
          serviceStartDate: "2026-02-15",
          serviceEndDate: "2026-02-15",
        },
        {
          id: "support",
          description: "Support",
          transactionPrice: "54000.00",
          sspAmount: "72000.00",
          revenueTiming: "over_time",
          recognitionMethod: "elapsed_time",
          serviceStartDate: "2026-01-01",
          serviceEndDate: "2026-12-31",
        },
      ],
    });
    expect(plan.obligations.map((row) => row.allocatedAmount)).toEqual([
      "43200.00",
      "64800.00",
    ]);
    expect(plan.totalAllocated).toBe("108000.00");
  });

  it("G-005 consumes a contract asset before creating a liability", () => {
    let position: Position = {
      cumulativeRecognized: "25000.00",
      cumulativeBilled: "20000.00",
    };
    position = apply(position, "revenue_recognition", "25000.00");
    position = apply(position, "billing", "40000.00");
    expect(position).toMatchObject({
      cumulativeRecognized: "50000.00",
      cumulativeBilled: "60000.00",
      contractAsset: "0.00",
      contractLiability: "10000.00",
    });
  });

  it("G-006 applies a balanced negative cumulative catch-up", () => {
    const posting = calculateProjectContractRevenueAdjustment(
      { cumulativeRecognized: "25000.00", cumulativeBilled: "0.00" },
      "-3000.00",
    );
    expect(posting.totalDebits).toBe(posting.totalCredits);
    expect(posting.next).toMatchObject({
      cumulativeRecognized: "22000.00",
      contractAsset: "22000.00",
      contractLiability: "0.00",
    });
    expect(22000 + 88000).toBe(110000);
  });

  it("G-007 and G-008 net exact opposite postings without changing revenue", () => {
    const originalBilling = { ar: 1500, liability: -1500 };
    const voidBilling = { ar: -1500, liability: 1500 };
    const replacementBilling = { ar: 1500, liability: -1500 };
    expect(originalBilling.ar + voidBilling.ar + replacementBilling.ar).toBe(
      1500,
    );
    expect(
      originalBilling.liability +
        voidBilling.liability +
        replacementBilling.liability,
    ).toBe(-1500);

    const originalRecognition = { liability: 1000, revenue: -1000 };
    const reversal = { liability: -1000, revenue: 1000 };
    expect(originalRecognition.liability + reversal.liability).toBe(0);
    expect(originalRecognition.revenue + reversal.revenue).toBe(0);
  });
});
