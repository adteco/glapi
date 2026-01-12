import { z } from 'zod';

/**
 * Status enum for close tasks
 */
export const CloseTaskStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'COMPLETED',
  'BLOCKED',
  'SKIPPED',
]);
export type CloseTaskStatus = z.infer<typeof CloseTaskStatusEnum>;

/**
 * Priority enum for close tasks
 */
export const CloseTaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type CloseTaskPriority = z.infer<typeof CloseTaskPriorityEnum>;

/**
 * Severity enum for variance alerts
 */
export const VarianceAlertSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export type VarianceAlertSeverity = z.infer<typeof VarianceAlertSeverityEnum>;

/**
 * Status enum for tie-out instances
 */
export const TieoutStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'RECONCILED',
  'VARIANCE_IDENTIFIED',
  'APPROVED',
]);
export type TieoutStatus = z.infer<typeof TieoutStatusEnum>;

// ============================================================================
// Close Task Templates
// ============================================================================

export const closeTaskTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateName: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  defaultPriority: CloseTaskPriorityEnum,
  estimatedDurationMinutes: z.number().int().nullable().optional(),
  dependsOnTemplateId: z.string().uuid().nullable().optional(),
  requiredRole: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  automationConfig: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CloseTaskTemplate = z.infer<typeof closeTaskTemplateSchema>;

export const createCloseTaskTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  templateName: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultPriority: CloseTaskPriorityEnum.default('MEDIUM'),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  dependsOnTemplateId: z.string().uuid().optional(),
  requiredRole: z.string().optional(),
  instructions: z.string().optional(),
  automationConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type CreateCloseTaskTemplateInput = z.infer<typeof createCloseTaskTemplateSchema>;

export const updateCloseTaskTemplateSchema = createCloseTaskTemplateSchema.partial().omit({
  organizationId: true,
});

export type UpdateCloseTaskTemplateInput = z.infer<typeof updateCloseTaskTemplateSchema>;

// ============================================================================
// Close Checklists
// ============================================================================

export const closeChecklistSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  checklistName: z.string().min(1),
  description: z.string().nullable().optional(),
  status: CloseTaskStatusEnum,
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CloseChecklist = z.infer<typeof closeChecklistSchema>;

export const createCloseChecklistSchema = z.object({
  organizationId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  checklistName: z.string().min(1, 'Checklist name is required'),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
});

export type CreateCloseChecklistInput = z.infer<typeof createCloseChecklistSchema>;

export const updateCloseChecklistSchema = z.object({
  checklistName: z.string().min(1).optional(),
  description: z.string().optional(),
  status: CloseTaskStatusEnum.optional(),
  dueDate: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
});

export type UpdateCloseChecklistInput = z.infer<typeof updateCloseChecklistSchema>;

// ============================================================================
// Close Tasks
// ============================================================================

export const closeTaskSchema = z.object({
  id: z.string().uuid(),
  checklistId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  taskName: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: CloseTaskStatusEnum,
  priority: CloseTaskPriorityEnum,
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  completedBy: z.string().uuid().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  attachments: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CloseTask = z.infer<typeof closeTaskSchema>;

export const createCloseTaskSchema = z.object({
  checklistId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  taskName: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: CloseTaskPriorityEnum.default('MEDIUM'),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateCloseTaskInput = z.infer<typeof createCloseTaskSchema>;

export const updateCloseTaskSchema = z.object({
  taskName: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: CloseTaskStatusEnum.optional(),
  priority: CloseTaskPriorityEnum.optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  blockedReason: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateCloseTaskInput = z.infer<typeof updateCloseTaskSchema>;

// ============================================================================
// Variance Thresholds
// ============================================================================

export const varianceThresholdSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  thresholdName: z.string().min(1),
  description: z.string().nullable().optional(),
  metricType: z.string().min(1),
  accountId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  absoluteThreshold: z.string().nullable().optional(),
  percentageThreshold: z.string().nullable().optional(),
  comparisonType: z.string().min(1),
  severity: VarianceAlertSeverityEnum,
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VarianceThreshold = z.infer<typeof varianceThresholdSchema>;

export const createVarianceThresholdSchema = z.object({
  organizationId: z.string().uuid(),
  thresholdName: z.string().min(1, 'Threshold name is required'),
  description: z.string().optional(),
  metricType: z.string().min(1, 'Metric type is required'),
  accountId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  absoluteThreshold: z.string().optional(),
  percentageThreshold: z.string().optional(),
  comparisonType: z.string().min(1, 'Comparison type is required'),
  severity: VarianceAlertSeverityEnum.default('WARNING'),
  isActive: z.boolean().default(true),
});

export type CreateVarianceThresholdInput = z.infer<typeof createVarianceThresholdSchema>;

export const updateVarianceThresholdSchema = createVarianceThresholdSchema
  .partial()
  .omit({ organizationId: true });

export type UpdateVarianceThresholdInput = z.infer<typeof updateVarianceThresholdSchema>;

// ============================================================================
// Variance Alerts
// ============================================================================

export const varianceAlertSchema = z.object({
  id: z.string().uuid(),
  thresholdId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  alertMessage: z.string().min(1),
  metricName: z.string().min(1),
  expectedValue: z.string().nullable().optional(),
  actualValue: z.string().nullable().optional(),
  varianceAmount: z.string().nullable().optional(),
  variancePercentage: z.string().nullable().optional(),
  severity: VarianceAlertSeverityEnum,
  isAcknowledged: z.boolean(),
  acknowledgedBy: z.string().uuid().nullable().optional(),
  acknowledgedAt: z.date().nullable().optional(),
  acknowledgedNote: z.string().nullable().optional(),
  isResolved: z.boolean(),
  resolvedBy: z.string().uuid().nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  createdAt: z.date(),
});

export type VarianceAlert = z.infer<typeof varianceAlertSchema>;

export const createVarianceAlertSchema = z.object({
  thresholdId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  alertMessage: z.string().min(1, 'Alert message is required'),
  metricName: z.string().min(1, 'Metric name is required'),
  expectedValue: z.string().optional(),
  actualValue: z.string().optional(),
  varianceAmount: z.string().optional(),
  variancePercentage: z.string().optional(),
  severity: VarianceAlertSeverityEnum.default('WARNING'),
});

export type CreateVarianceAlertInput = z.infer<typeof createVarianceAlertSchema>;

export const acknowledgeVarianceAlertSchema = z.object({
  acknowledgedNote: z.string().optional(),
});

export type AcknowledgeVarianceAlertInput = z.infer<typeof acknowledgeVarianceAlertSchema>;

export const resolveVarianceAlertSchema = z.object({
  resolutionNote: z.string().optional(),
});

export type ResolveVarianceAlertInput = z.infer<typeof resolveVarianceAlertSchema>;

// ============================================================================
// Tieout Templates
// ============================================================================

export const tieoutTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateName: z.string().min(1),
  description: z.string().nullable().optional(),
  sourceSystem: z.string().min(1),
  sourceQuery: z.string().nullable().optional(),
  targetSystem: z.string().min(1),
  targetQuery: z.string().nullable().optional(),
  reconciliationRules: z.record(z.unknown()).nullable().optional(),
  toleranceAmount: z.string().nullable().optional(),
  tolerancePercentage: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TieoutTemplate = z.infer<typeof tieoutTemplateSchema>;

export const createTieoutTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  templateName: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  sourceSystem: z.string().min(1, 'Source system is required'),
  sourceQuery: z.string().optional(),
  targetSystem: z.string().min(1, 'Target system is required'),
  targetQuery: z.string().optional(),
  reconciliationRules: z.record(z.unknown()).optional(),
  toleranceAmount: z.string().optional(),
  tolerancePercentage: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreateTieoutTemplateInput = z.infer<typeof createTieoutTemplateSchema>;

export const updateTieoutTemplateSchema = createTieoutTemplateSchema
  .partial()
  .omit({ organizationId: true });

export type UpdateTieoutTemplateInput = z.infer<typeof updateTieoutTemplateSchema>;

// ============================================================================
// Tieout Instances
// ============================================================================

export const tieoutInstanceSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  status: TieoutStatusEnum,
  sourceValue: z.string().nullable().optional(),
  targetValue: z.string().nullable().optional(),
  varianceAmount: z.string().nullable().optional(),
  executedAt: z.date().nullable().optional(),
  executedBy: z.string().uuid().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  supportingDocuments: z.array(z.string()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TieoutInstance = z.infer<typeof tieoutInstanceSchema>;

export const createTieoutInstanceSchema = z.object({
  templateId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
});

export type CreateTieoutInstanceInput = z.infer<typeof createTieoutInstanceSchema>;

export const updateTieoutInstanceSchema = z.object({
  status: TieoutStatusEnum.optional(),
  sourceValue: z.string().optional(),
  targetValue: z.string().optional(),
  varianceAmount: z.string().optional(),
  notes: z.string().optional(),
  supportingDocuments: z.array(z.string()).optional(),
});

export type UpdateTieoutInstanceInput = z.infer<typeof updateTieoutInstanceSchema>;

// ============================================================================
// Close Notifications
// ============================================================================

export const closeNotificationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountingPeriodId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
  notificationType: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  isRead: z.boolean(),
  readAt: z.date().nullable().optional(),
  createdAt: z.date(),
});

export type CloseNotification = z.infer<typeof closeNotificationSchema>;

export const createCloseNotificationSchema = z.object({
  organizationId: z.string().uuid(),
  accountingPeriodId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  notificationType: z.string().min(1, 'Notification type is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

export type CreateCloseNotificationInput = z.infer<typeof createCloseNotificationSchema>;

// ============================================================================
// Filter Schemas
// ============================================================================

export const closeTaskFiltersSchema = z.object({
  checklistId: z.string().uuid().optional(),
  status: z.union([CloseTaskStatusEnum, z.array(CloseTaskStatusEnum)]).optional(),
  priority: z.union([CloseTaskPriorityEnum, z.array(CloseTaskPriorityEnum)]).optional(),
  assignedTo: z.string().uuid().optional(),
  category: z.string().optional(),
  isOverdue: z.boolean().optional(),
});

export type CloseTaskFilters = z.infer<typeof closeTaskFiltersSchema>;

export const varianceAlertFiltersSchema = z.object({
  accountingPeriodId: z.string().uuid().optional(),
  severity: z.union([VarianceAlertSeverityEnum, z.array(VarianceAlertSeverityEnum)]).optional(),
  isAcknowledged: z.boolean().optional(),
  isResolved: z.boolean().optional(),
});

export type VarianceAlertFilters = z.infer<typeof varianceAlertFiltersSchema>;

export const tieoutFiltersSchema = z.object({
  accountingPeriodId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  status: z.union([TieoutStatusEnum, z.array(TieoutStatusEnum)]).optional(),
});

export type TieoutFilters = z.infer<typeof tieoutFiltersSchema>;

// ============================================================================
// Dashboard/Summary Types
// ============================================================================

export interface CloseStatusSummary {
  checklistId: string;
  checklistName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  completionPercentage: number;
}

export interface VarianceAlertSummary {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
}

export interface TieoutSummary {
  totalTieouts: number;
  pendingTieouts: number;
  reconciledTieouts: number;
  varianceIdentifiedTieouts: number;
  approvedTieouts: number;
}

// ============================================================================
// Bulk Operation Schemas
// ============================================================================

export const generateTasksFromTemplatesSchema = z.object({
  checklistId: z.string().uuid(),
  templateIds: z.array(z.string().uuid()).min(1, 'At least one template is required'),
  defaultAssignedTo: z.string().uuid().optional(),
  dueDateOffset: z.number().int().optional(), // Days from checklist due date
});

export type GenerateTasksFromTemplatesInput = z.infer<typeof generateTasksFromTemplatesSchema>;

export const bulkUpdateTaskStatusSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  status: CloseTaskStatusEnum,
  notes: z.string().optional(),
});

export type BulkUpdateTaskStatusInput = z.infer<typeof bulkUpdateTaskStatusSchema>;

export const runVarianceCheckSchema = z.object({
  accountingPeriodId: z.string().uuid(),
  thresholdIds: z.array(z.string().uuid()).optional(), // If not provided, run all active thresholds
});

export type RunVarianceCheckInput = z.infer<typeof runVarianceCheckSchema>;

export const executeTieoutsSchema = z.object({
  accountingPeriodId: z.string().uuid(),
  templateIds: z.array(z.string().uuid()).optional(), // If not provided, execute all active templates
});

export type ExecuteTieoutsInput = z.infer<typeof executeTieoutsSchema>;
