import { pgTable, uuid, date, numeric, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { projects } from './projects';
import { subsidiaries } from './subsidiaries';
import { glTransactions } from './gl-transactions';

export const projectProgressSnapshots = pgTable(
  'project_progress_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    subsidiaryId: uuid('subsidiary_id').references(() => subsidiaries.id, { onDelete: 'set null' }),
    snapshotDate: date('snapshot_date').defaultNow().notNull(),
    totalBudgetAmount: numeric('total_budget_amount', { precision: 18, scale: 4 }).default('0').notNull(),
    totalCommittedAmount: numeric('total_committed_amount', { precision: 18, scale: 4 })
      .default('0')
      .notNull(),
    totalActualCost: numeric('total_actual_cost', { precision: 18, scale: 4 }).default('0').notNull(),
    totalWipClearing: numeric('total_wip_clearing', { precision: 18, scale: 4 }).default('0').notNull(),
    percentComplete: numeric('percent_complete', { precision: 8, scale: 4 }).default('0').notNull(),
    sourceGlTransactionId: uuid('source_gl_transaction_id').references(() => glTransactions.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectDateIdx: index('idx_project_progress_snapshots_proj_date').on(
      table.projectId,
      table.snapshotDate.desc()
    ),
  })
);

export const projectProgressSnapshotsRelations = relations(projectProgressSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectProgressSnapshots.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [projectProgressSnapshots.projectId],
    references: [projects.id],
  }),
  subsidiary: one(subsidiaries, {
    fields: [projectProgressSnapshots.subsidiaryId],
    references: [subsidiaries.id],
  }),
  sourceTransaction: one(glTransactions, {
    fields: [projectProgressSnapshots.sourceGlTransactionId],
    references: [glTransactions.id],
  }),
}));

export type ProjectProgressSnapshot = typeof projectProgressSnapshots.$inferSelect;
export type NewProjectProgressSnapshot = typeof projectProgressSnapshots.$inferInsert;
