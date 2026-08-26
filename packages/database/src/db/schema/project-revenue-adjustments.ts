import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accountingPeriods } from "./accounting-periods";
import { organizations } from "./organizations";
import { projectContracts, projectContractVersions } from "./project-contracts";
import {
  revenueRecognitionRunItems,
  revenueRecognitionRuns,
} from "./revenue-recognition-runs";
import { revenueSchedules } from "./revenue-schedules";
import { subsidiaries } from "./subsidiaries";
import { glTransactions } from "./gl-transactions";

export const projectContractModificationMethodEnum = pgEnum(
  "project_contract_modification_method",
  ["prospective", "cumulative_catch_up", "separate_contract"],
);

/** Immutable receipt for an applied ASC 606 project-contract modification. */
export const projectContractModifications = pgTable(
  "project_contract_modifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    projectContractId: uuid("project_contract_id")
      .notNull()
      .references(() => projectContracts.id),
    priorVersionId: uuid("prior_version_id")
      .notNull()
      .references(() => projectContractVersions.id),
    revisedVersionId: uuid("revised_version_id")
      .notNull()
      .references(() => projectContractVersions.id),
    method: projectContractModificationMethodEnum("method").notNull(),
    effectiveDate: date("effective_date").notNull(),
    priorAllocatedAmount: decimal("prior_allocated_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    revisedAllocatedAmount: decimal("revised_allocated_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    priorRecognizedAmount: decimal("prior_recognized_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    progressPercentage: decimal("progress_percentage", {
      precision: 9,
      scale: 6,
    }),
    revisedCumulativeRevenue: decimal("revised_cumulative_revenue", {
      precision: 14,
      scale: 2,
    }).notNull(),
    catchUpAdjustment: decimal("catch_up_adjustment", {
      precision: 14,
      scale: 2,
    }).notNull(),
    catchUpGlTransactionId: uuid("catch_up_gl_transaction_id").references(
      () => glTransactions.id,
    ),
    remainingAllocation: decimal("remaining_allocation", {
      precision: 14,
      scale: 2,
    }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    appliedBy: text("applied_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex(
      "ux_project_contract_modifications_org_key",
    ).on(table.organizationId, table.idempotencyKey),
    revisedVersionUnique: uniqueIndex(
      "ux_project_contract_modifications_revised_version",
    ).on(table.revisedVersionId),
    contractIdx: index("idx_project_contract_modifications_contract").on(
      table.organizationId,
      table.projectContractId,
      table.createdAt,
    ),
    requestHashLength: check(
      "chk_project_contract_modifications_request_hash",
      sql`length(${table.requestHash}) = 64`,
    ),
    nonnegativeAmounts: check(
      "chk_project_contract_modifications_amounts",
      sql`${table.priorAllocatedAmount} >= 0 AND ${table.revisedAllocatedAmount} >= 0 AND ${table.priorRecognizedAmount} >= 0 AND ${table.revisedCumulativeRevenue} >= 0 AND ${table.remainingAllocation} >= 0`,
    ),
  }),
);

/** Lineage from immutable future schedules to the modification that superseded them. */
export const projectContractModificationSchedules = pgTable(
  "project_contract_modification_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    modificationId: uuid("modification_id")
      .notNull()
      .references(() => projectContractModifications.id),
    supersededScheduleId: uuid("superseded_schedule_id")
      .notNull()
      .references(() => revenueSchedules.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    scheduleUnique: uniqueIndex(
      "ux_project_contract_modification_schedules_schedule",
    ).on(table.supersededScheduleId),
    modificationIdx: index(
      "idx_project_contract_modification_schedules_modification",
    ).on(table.organizationId, table.modificationId),
  }),
);

/** Immutable reversal receipt; the original recognition run and schedules are never rewritten. */
export const projectRevenueRecognitionReversals = pgTable(
  "project_revenue_recognition_reversals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    subsidiaryId: uuid("subsidiary_id")
      .notNull()
      .references(() => subsidiaries.id),
    originalRunId: uuid("original_run_id")
      .notNull()
      .references(() => revenueRecognitionRuns.id),
    originalGlTransactionId: uuid("original_gl_transaction_id")
      .notNull()
      .references(() => glTransactions.id),
    accountingPeriodId: uuid("accounting_period_id")
      .notNull()
      .references(() => accountingPeriods.id),
    reversalDate: date("reversal_date").notNull(),
    totalReversedAmount: decimal("total_reversed_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    approvedBy: text("approved_by").notNull(),
    workerActor: text("worker_actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("ux_project_revenue_reversals_org_key").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    originalRunUnique: uniqueIndex(
      "ux_project_revenue_reversals_original_run",
    ).on(table.originalRunId),
    periodIdx: index("idx_project_revenue_reversals_period").on(
      table.organizationId,
      table.accountingPeriodId,
      table.createdAt,
    ),
    requestHashLength: check(
      "chk_project_revenue_reversals_request_hash",
      sql`length(${table.requestHash}) = 64`,
    ),
    nonnegativeTotal: check(
      "chk_project_revenue_reversals_total",
      sql`${table.totalReversedAmount} >= 0`,
    ),
  }),
);

export const projectRevenueRecognitionReversalItems = pgTable(
  "project_revenue_recognition_reversal_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    reversalId: uuid("reversal_id")
      .notNull()
      .references(() => projectRevenueRecognitionReversals.id),
    originalRunItemId: uuid("original_run_item_id")
      .notNull()
      .references(() => revenueRecognitionRunItems.id),
    revenueScheduleId: uuid("revenue_schedule_id")
      .notNull()
      .references(() => revenueSchedules.id),
    reversedAmount: decimal("reversed_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    originalItemUnique: uniqueIndex(
      "ux_project_revenue_reversal_items_original",
    ).on(table.originalRunItemId),
    reversalIdx: index("idx_project_revenue_reversal_items_reversal").on(
      table.organizationId,
      table.reversalId,
    ),
    nonnegativeAmount: check(
      "chk_project_revenue_reversal_items_amount",
      sql`${table.reversedAmount} >= 0`,
    ),
  }),
);

export const projectContractModificationsRelations = relations(
  projectContractModifications,
  ({ many }) => ({ schedules: many(projectContractModificationSchedules) }),
);

export const projectRevenueRecognitionReversalsRelations = relations(
  projectRevenueRecognitionReversals,
  ({ many }) => ({ items: many(projectRevenueRecognitionReversalItems) }),
);

export type ProjectContractModification =
  typeof projectContractModifications.$inferSelect;
export type ProjectRevenueRecognitionReversal =
  typeof projectRevenueRecognitionReversals.$inferSelect;
export type ProjectRevenueRecognitionReversalItem =
  typeof projectRevenueRecognitionReversalItems.$inferSelect;
