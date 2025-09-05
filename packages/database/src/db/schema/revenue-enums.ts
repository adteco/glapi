import { pgEnum } from "drizzle-orm/pg-core";

// Obligation type enum - defines the type of performance obligation
export const obligationTypeEnum = pgEnum("obligation_type", [
  "product_license",
  "maintenance_support",
  "professional_services",
  "hosting_services",
  "other"
]);

// Satisfaction method enum - how the obligation is satisfied
export const satisfactionMethodEnum = pgEnum("satisfaction_method", [
  "point_in_time",
  "over_time"
]);

// Recognition pattern enum - how revenue is recognized over time
export const recognitionPatternEnum = pgEnum("recognition_pattern", [
  "straight_line",
  "proportional",
  "milestone_based",
  "usage_based"
]);

// Schedule status enum - status of revenue schedule entries
export const scheduleStatusEnum = pgEnum("schedule_status", [
  "scheduled",
  "recognized",
  "deferred",
  "cancelled"
]);

// Performance obligation status enum
export const poStatusEnum = pgEnum("po_status", [
  "active",
  "satisfied",
  "cancelled"
]);

// SSP evidence type enum
export const evidenceTypeEnum = pgEnum("evidence_type", [
  "standalone_sale",
  "competitor_pricing",
  "cost_plus_margin",
  "market_assessment"
]);

// Confidence level enum for SSP evidence
export const confidenceLevelEnum = pgEnum("confidence_level", [
  "high",
  "medium",
  "low"
]);

// Allocation method enum for SSP allocations
export const allocationMethodEnum = pgEnum("allocation_method", [
  "ssp_proportional",
  "residual",
  "specified_percentage"
]);

// Journal entry status enum
export const journalStatusEnum = pgEnum("journal_status", [
  "draft",
  "posted",
  "reversed"
]);