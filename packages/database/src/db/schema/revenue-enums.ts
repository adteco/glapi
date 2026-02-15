import { pgEnum } from "drizzle-orm/pg-core";

// NOTE: These pgEnum declarations must match the live Postgres enum types in RDS.
// If the labels drift, inserts will fail at runtime.

export const performanceObligationStatusEnum = pgEnum(
  "performance_obligation_status_enum",
  ["Pending", "InProcess", "Fulfilled", "PartiallyFulfilled", "Cancelled"]
);

export const recognitionSourceEnum = pgEnum("recognition_source", [
  "automatic",
  "manual_adjustment",
  "milestone_achievement",
]);

// Used by contract_ssp_allocations in the live schema.
export const allocationMethodEnum = pgEnum("allocation_method", [
  "proportional",
  "residual",
  "specific_evidence",
]);

export const evidenceTypeEnum = pgEnum("evidence_type", [
  "customer_pricing",
  "comparable_sales",
  "market_research",
  "cost_plus",
]);

export const confidenceLevelEnum = pgEnum("confidence_level", [
  "high",
  "medium",
  "low",
]);

// NOTE: This enum is referenced by application code, but the live RDS schema
// currently does not expose it on `revenue_journal_entries`. It's kept here so
// the package compiles while we work toward unifying the journal entry schema.
export const journalStatusEnum = pgEnum("journal_status", [
  "draft",
  "posted",
  "failed",
]);
