import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';
import { eventStore } from './event-store';
import { approvalInstances } from './approval-workflow';

// ============================================================================
// Enums
// ============================================================================

/**
 * Audit action types for categorizing mutations
 */
export const auditActionTypeEnum = pgEnum('audit_action_type_enum', [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'SUBMIT',
  'POST',
  'REVERSE',
  'CLOSE',
  'REOPEN',
  'ARCHIVE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'PERMISSION_CHANGE',
  'ROLE_CHANGE',
  'EXPORT',
  'IMPORT',
]);

/**
 * Audit log severity levels
 */
export const auditSeverityEnum = pgEnum('audit_severity_enum', [
  'INFO',
  'WARNING',
  'CRITICAL',
]);

/**
 * Change request statuses
 */
export const changeRequestStatusEnum = pgEnum('change_request_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'completed',
  'cancelled',
]);

export const changeRequests = pgTable(
  'change_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    description: text('description'),
    requestType: text('request_type'),
    subsystem: text('subsystem'),
    riskLevel: text('risk_level'),
    status: changeRequestStatusEnum('status').notNull().default('draft'),

    linkedResourceType: text('linked_resource_type'),
    linkedResourceId: text('linked_resource_id'),

    changeWindowStart: timestamp('change_window_start', { withTimezone: true }),
    changeWindowEnd: timestamp('change_window_end', { withTimezone: true }),

    approvalInstanceId: text('approval_instance_id').references(() => approvalInstances.id, {
      onDelete: 'set null',
    }),

    metadata: jsonb('metadata'),

    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index('change_requests_org_idx').on(table.organizationId, table.status),
    approvalIdx: index('change_requests_approval_idx').on(table.approvalInstanceId),
  }),
);

// ============================================================================
// Unified Audit Log Table
// ============================================================================

/**
 * Unified Audit Log - Centralized audit trail for all mutating actions
 *
 * This table captures a complete audit trail with:
 * - Actor identification (who performed the action)
 * - Action classification (what was done)
 * - Payload hash for integrity verification
 * - Event correlation for traceability
 * - Multi-tenant support
 */
export const unifiedAuditLog = pgTable('unified_audit_log', {
  // Primary key
  id: uuid('id').defaultRandom().primaryKey(),

  // Organization (multi-tenancy)
  organizationId: text('organization_id').notNull().references(() => organizations.id),

  // Event correlation (optional link to event store)
  eventId: uuid('event_id').references(() => eventStore.id),
  correlationId: uuid('correlation_id'),
  causationId: uuid('causation_id'),

  // Actor identification
  actorId: text('actor_id').notNull(), // User ID or system identifier
  actorType: text('actor_type').notNull().default('USER'), // USER, SYSTEM, API_KEY, SERVICE
  actorEmail: text('actor_email'),
  actorName: text('actor_name'),

  // Session context
  sessionId: text('session_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // Action classification
  actionType: auditActionTypeEnum('action_type').notNull(),
  actionDescription: text('action_description'),
  severity: auditSeverityEnum('severity').default('INFO').notNull(),

  // Resource identification
  resourceType: text('resource_type').notNull(), // Table/entity name
  resourceId: text('resource_id').notNull(), // Primary key of affected resource
  resourceName: text('resource_name'), // Human-readable identifier

  // Payload capture
  previousState: jsonb('previous_state'), // State before change (for updates/deletes)
  newState: jsonb('new_state'), // State after change (for creates/updates)
  changedFields: jsonb('changed_fields'), // Array of field names that changed
  payloadHash: text('payload_hash').notNull(), // SHA-256 hash of the payload for integrity

  // Metadata
  metadata: jsonb('metadata'), // Additional context (request headers, etc.)

  // Timing
  occurredAt: timestamp('occurred_at', { withTimezone: true, precision: 6 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),

  // Processing flags
  exported: boolean('exported').default(false).notNull(),
  exportedAt: timestamp('exported_at', { withTimezone: true }),
}, (table) => ({
  // Index for organization-scoped queries (most common)
  orgTimeIdx: index('audit_log_org_time_idx')
    .on(table.organizationId, table.occurredAt),

  // Index for actor queries
  actorIdx: index('audit_log_actor_idx')
    .on(table.actorId, table.occurredAt),

  // Index for resource queries
  resourceIdx: index('audit_log_resource_idx')
    .on(table.resourceType, table.resourceId),

  // Index for action type queries
  actionIdx: index('audit_log_action_idx')
    .on(table.actionType, table.occurredAt),

  // Index for correlation tracing
  correlationIdx: index('audit_log_correlation_idx')
    .on(table.correlationId),

  // Index for event linkage
  eventIdx: index('audit_log_event_idx')
    .on(table.eventId),

  // Index for export processing
  exportIdx: index('audit_log_export_idx')
    .on(table.exported, table.recordedAt),

  // Index for severity-based queries (critical events)
  severityIdx: index('audit_log_severity_idx')
    .on(table.severity, table.occurredAt),
}));

// ============================================================================
// Audit Log Evidence Packages
// ============================================================================

/**
 * Audit Evidence Packages - Bundles of audit logs for compliance export
 *
 * Evidence packages are created for:
 * - SOX compliance audits
 * - External audit requests
 * - Legal discovery
 * - Regulatory reporting
 */
export const auditEvidencePackages = pgTable('audit_evidence_packages', {
  id: uuid('id').defaultRandom().primaryKey(),

  organizationId: text('organization_id').notNull().references(() => organizations.id),

  // Package metadata
  packageName: text('package_name').notNull(),
  description: text('description'),

  // Date range for included logs
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),

  // Filters applied
  filters: jsonb('filters'), // { resourceTypes: [], actionTypes: [], actorIds: [] }

  // Package content
  logCount: text('log_count').notNull(),
  contentHash: text('content_hash').notNull(), // SHA-256 of entire package for integrity
  storageLocation: text('storage_location'), // S3 path or file system path

  // Status
  status: text('status').notNull().default('PENDING'), // PENDING, GENERATING, READY, EXPIRED, FAILED
  errorMessage: text('error_message'),
  autoGenerated: boolean('auto_generated').default(false).notNull(),
  changeRequestId: uuid('change_request_id').references(() => changeRequests.id, {
    onDelete: 'set null',
  }),

  // Access control
  createdBy: text('created_by').notNull(),
  accessibleBy: jsonb('accessible_by'), // Array of user IDs who can access

  // Timing
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('evidence_package_org_idx')
    .on(table.organizationId, table.createdAt),

  statusIdx: index('evidence_package_status_idx')
    .on(table.status, table.createdAt),

  createdByIdx: index('evidence_package_created_by_idx')
    .on(table.createdBy),
}));

// ============================================================================
// Relations
// ============================================================================

export const unifiedAuditLogRelations = relations(unifiedAuditLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [unifiedAuditLog.organizationId],
    references: [organizations.id],
  }),
  event: one(eventStore, {
    fields: [unifiedAuditLog.eventId],
    references: [eventStore.id],
  }),
}));

export const auditEvidencePackagesRelations = relations(auditEvidencePackages, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvidencePackages.organizationId],
    references: [organizations.id],
  }),
  changeRequest: one(changeRequests, {
    fields: [auditEvidencePackages.changeRequestId],
    references: [changeRequests.id],
  }),
}));

export const changeRequestsRelations = relations(changeRequests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [changeRequests.organizationId],
    references: [organizations.id],
  }),
  approvalInstance: one(approvalInstances, {
    fields: [changeRequests.approvalInstanceId],
    references: [approvalInstances.id],
  }),
  evidencePackages: many(auditEvidencePackages),
}));

// ============================================================================
// Types
// ============================================================================

export type UnifiedAuditLogRecord = InferSelectModel<typeof unifiedAuditLog>;
export type NewUnifiedAuditLogRecord = InferInsertModel<typeof unifiedAuditLog>;

export type AuditEvidencePackageRecord = InferSelectModel<typeof auditEvidencePackages>;
export type NewAuditEvidencePackageRecord = InferInsertModel<typeof auditEvidencePackages>;

export type ChangeRequestRecord = InferSelectModel<typeof changeRequests>;
export type NewChangeRequestRecord = InferInsertModel<typeof changeRequests>;

// Audit action type
export const AuditActionType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUBMIT: 'SUBMIT',
  POST: 'POST',
  REVERSE: 'REVERSE',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
  ARCHIVE: 'ARCHIVE',
  RESTORE: 'RESTORE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

export type AuditActionTypeValue = typeof AuditActionType[keyof typeof AuditActionType];

// Audit severity
export const AuditSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

export type AuditSeverityValue = typeof AuditSeverity[keyof typeof AuditSeverity];
