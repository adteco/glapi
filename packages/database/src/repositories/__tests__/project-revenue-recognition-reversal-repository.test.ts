import { describe, expect, it, vi } from "vitest";

vi.mock("../base-repository", () => ({
  BaseRepository: class {},
}));
import { reverseProjectRevenueGlLines } from "../project-revenue-recognition-reversal-repository";

describe("reverseProjectRevenueGlLines", () => {
  it("produces the exact opposite balanced G008 posting without changing lineage fields", () => {
    const original = [
      {
        accountId: "contract-liability",
        projectContractId: "contract-1",
        debitAmount: "1000.00",
        creditAmount: "0.00",
        baseDebitAmount: "1000.00",
        baseCreditAmount: "0.00",
      },
      {
        accountId: "services-revenue",
        projectContractId: "contract-1",
        debitAmount: "0.00",
        creditAmount: "1000.00",
        baseDebitAmount: "0.00",
        baseCreditAmount: "1000.00",
      },
    ];

    expect(reverseProjectRevenueGlLines(original)).toEqual([
      expect.objectContaining({
        accountId: "contract-liability",
        projectContractId: "contract-1",
        debitAmount: "0.00",
        creditAmount: "1000.00",
      }),
      expect.objectContaining({
        accountId: "services-revenue",
        projectContractId: "contract-1",
        debitAmount: "1000.00",
        creditAmount: "0.00",
      }),
    ]);
    expect(original[0].debitAmount).toBe("1000.00");
  });
});
