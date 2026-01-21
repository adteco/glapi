import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  boolean,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel, relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';

/**
 * Approval workflow status enum
 */
export const approvalStatusEnum = pgEnum('approval_status_enum', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

/**
 * Approval action types
 */
export const workflowApprovalActionTypeEnum = pgEnum('workflow_approval_action_type_enum', [
  'APPROVE',
  'REJECT',
  'REQUEST_INFO',
  'DELEGATE',
  'ESCALATE',
  'COMMENT',
]);

/**
 * Approval instances table - tracks workflow instances for approvals
 */
export const approvalInstances = pgTable(
  'approval_instances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workflowType: text('workflow_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    documentId: text('document_id'),
    status: approvalStatusEnum('status').notNull().default('pending'),
    currentStep: integer('current_step').default(1),
    totalSteps: integer('total_steps').default(1),
    submittedBy: uuid('submitted_by').references(() => users.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('approval_instances_org_idx').on(table.organizationId),
    entityIdx: index('approval_instances_entity_idx').on(table.entityType, table.entityId),
    statusIdx: index('approval_instances_status_idx').on(table.status),
  })
);

/**
 * Approval actions table - tracks individual approval actions
 */
export const approvalActions = pgTable(
  'approval_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    approvalInstanceId: uuid('approval_instance_id')
      .notNull()
      .references(() => approvalInstances.id, { onDelete: 'cascade' }),
    actionType: workflowApprovalActionTypeEnum('action_type').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    stepNumber: integer('step_number').default(1),
    comments: text('comments'),
    delegatedTo: uuid('delegated_to').references(() => users.id),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    instanceIdx: index('approval_actions_instance_idx').on(table.approvalInstanceId),
    actorIdx: index('approval_actions_actor_idx').on(table.actorId),
  })
);

// Relations
export const approvalInstancesRelations = relations(approvalInstances, ({ many, one }) => ({
  actions: many(approvalActions),
  submitter: one(users, {
    fields: [approvalInstances.submittedBy],
    references: [users.id],
  }),
}));

export const approvalActionsRelations = relations(approvalActions, ({ one }) => ({
  instance: one(approvalInstances, {
    fields: [approvalActions.approvalInstanceId],
    references: [approvalInstances.id],
  }),
  actor: one(users, {
    fields: [approvalActions.actorId],
    references: [users.id],
  }),
  delegate: one(users, {
    fields: [approvalActions.delegatedTo],
    references: [users.id],
  }),
}));

export type ApprovalInstance = InferSelectModel<typeof approvalInstances>;
export type NewApprovalInstance = InferInsertModel<typeof approvalInstances>;
export type WorkflowApprovalAction = InferSelectModel<typeof approvalActions>;
export type NewApprovalAction = InferInsertModel<typeof approvalActions>;
