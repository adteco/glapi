import { pgEnum } from 'drizzle-orm/pg-core';

// Enum for entity types
export const entityTypeEnum = pgEnum('entity_type_enum', [
  'Customer',
  'Vendor',
  'Employee',
  'Partner',
]);

// Enum for cost estimate types, used in transaction lines
export const costEstimateTypeEnum = pgEnum('cost_estimate_type_enum', [
  'Estimated', // Cost is an estimate
  'Actual',    // Cost is actual
  'Derived',   // Cost is derived from other sources or calculations
  'None',      // No cost applicable or not yet determined
]);

// Enum for Job Statuses (from original jobStatuses.ts)
export const jobStatusEnum = pgEnum('job_status_enum', [
  'Planning',
  'InProgress',
  'OnHold',
  'Completed',
  'Billed',
  'Cancelled',
]);

// Enum for Time Entry Billed Status (from original timeEntries.ts reference)
export const timeEntryBilledStatusEnum = pgEnum('time_entry_billed_status_enum', [
  'NotBilled',
  'Billed',
  'NonBillable',
]);

// Add other shared enums here as your schema evolves 