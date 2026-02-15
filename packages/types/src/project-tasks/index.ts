/**
 * Project Tasks Types
 *
 * Zod schemas and TypeScript types for project task management including
 * milestones, task templates, project templates, and task instances.
 *
 * @module project-tasks
 */

import { z } from 'zod';
import {
  dateStringSchema,
  decimalStringSchema,
  metadataSchema,
  uuidSchema,
  uuidArraySchema,
  optionalUuidSchema,
  nullableOptionalUuidSchema,
  optionalPaginationInputSchema,
  sortDirectionSchema,
} from '../common';

// ============================================================================
// Status and Priority Enums
// ============================================================================

/**
 * Project task status enum
 */
export const ProjectTaskStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'COMPLETED',
  'BLOCKED',
  'CANCELLED',
]);
export type ProjectTaskStatus = z.infer<typeof ProjectTaskStatusEnum>;

/**
 * Project task priority enum
 */
export const ProjectTaskPriorityEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type ProjectTaskPriority = z.infer<typeof ProjectTaskPriorityEnum>;

/**
 * Project milestone status enum
 */
export const ProjectMilestoneStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export type ProjectMilestoneStatus = z.infer<typeof ProjectMilestoneStatusEnum>;

/**
 * Task billing type enum
 */
export const TaskBillingTypeEnum = z.enum(['flat_fee', 'time_and_materials']);
export type TaskBillingType = z.infer<typeof TaskBillingTypeEnum>;

/**
 * Valid task status transitions
 */
export const VALID_TASK_STATUS_TRANSITIONS: Record<ProjectTaskStatus, ProjectTaskStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED'],
  PENDING_REVIEW: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

/**
 * Valid milestone status transitions
 */
export const VALID_MILESTONE_STATUS_TRANSITIONS: Record<ProjectMilestoneStatus, ProjectMilestoneStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ============================================================================
// Project Milestone Schemas
// ============================================================================

/**
 * Schema for creating a project milestone
 */
export const createProjectMilestoneSchema = z.object({
  projectId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  targetDate: dateStringSchema.optional(),
  status: ProjectMilestoneStatusEnum.default('PENDING'),
  sortOrder: z.number().int().min(0).default(0),
  isBillingMilestone: z.boolean().default(false),
  metadata: metadataSchema,
});

export type CreateProjectMilestoneInput = z.infer<typeof createProjectMilestoneSchema>;

/**
 * Schema for updating a project milestone
 */
export const updateProjectMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  status: ProjectMilestoneStatusEnum.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isBillingMilestone: z.boolean().optional(),
  metadata: metadataSchema,
});

export type UpdateProjectMilestoneInput = z.infer<typeof updateProjectMilestoneSchema>;

/**
 * Project milestone filters schema
 */
export const projectMilestoneFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.union([ProjectMilestoneStatusEnum, z.array(ProjectMilestoneStatusEnum)]).optional(),
    isBillingMilestone: z.boolean().optional(),
  })
  .optional();

export type ProjectMilestoneFilters = z.infer<typeof projectMilestoneFiltersSchema>;

/**
 * Project milestone list input schema
 */
export const projectMilestoneListInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    orderBy: z.enum(['sortOrder', 'targetDate', 'name', 'createdAt']).optional(),
    orderDirection: sortDirectionSchema.optional(),
    filters: projectMilestoneFiltersSchema,
  })
  .optional();

export type ProjectMilestoneListInput = z.infer<typeof projectMilestoneListInputSchema>;

/**
 * Full project milestone schema
 */
export const projectMilestoneSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  organizationId: uuidSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  status: ProjectMilestoneStatusEnum,
  sortOrder: z.number(),
  isBillingMilestone: z.boolean(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;

// ============================================================================
// Project Task Template Schemas
// ============================================================================

/**
 * Schema for creating a project task template
 */
export const createProjectTaskTemplateSchema = z.object({
  subsidiaryId: optionalUuidSchema,
  templateCode: z.string().min(1, 'Template code is required').max(50),
  templateName: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  priority: ProjectTaskPriorityEnum.default('MEDIUM'),
  estimatedHours: z.number().positive().max(10000).optional(),
  instructions: z.string().max(5000).optional(),
  activityCodeId: optionalUuidSchema,
  defaultServiceItemId: optionalUuidSchema,
  defaultAssigneeId: optionalUuidSchema,
  dependsOnTemplateCodes: z.array(z.string().max(50)).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  metadata: metadataSchema,
});

export type CreateProjectTaskTemplateInput = z.infer<typeof createProjectTaskTemplateSchema>;

/**
 * Schema for updating a project task template
 */
export const updateProjectTaskTemplateSchema = z.object({
  templateCode: z.string().min(1).max(50).optional(),
  templateName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  priority: ProjectTaskPriorityEnum.optional(),
  estimatedHours: z.number().positive().max(10000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  activityCodeId: nullableOptionalUuidSchema,
  defaultServiceItemId: nullableOptionalUuidSchema,
  defaultAssigneeId: nullableOptionalUuidSchema,
  dependsOnTemplateCodes: z.array(z.string().max(50)).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: metadataSchema,
});

export type UpdateProjectTaskTemplateInput = z.infer<typeof updateProjectTaskTemplateSchema>;

/**
 * Project task template filters schema
 */
export const projectTaskTemplateFiltersSchema = z
  .object({
    category: z.string().optional(),
    isActive: z.boolean().optional(),
    subsidiaryId: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .optional();

export type ProjectTaskTemplateFilters = z.infer<typeof projectTaskTemplateFiltersSchema>;

/**
 * Project task template list input schema
 */
export const projectTaskTemplateListInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    orderBy: z.enum(['sortOrder', 'templateCode', 'templateName', 'createdAt']).optional(),
    orderDirection: sortDirectionSchema.optional(),
    filters: projectTaskTemplateFiltersSchema,
  })
  .optional();

export type ProjectTaskTemplateListInput = z.infer<typeof projectTaskTemplateListInputSchema>;

/**
 * Full project task template schema
 */
export const projectTaskTemplateSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  subsidiaryId: z.string().uuid().nullable().optional(),
  templateCode: z.string(),
  templateName: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  priority: ProjectTaskPriorityEnum,
  estimatedHours: z.number().nullable().optional(),
  instructions: z.string().nullable().optional(),
  activityCodeId: z.string().uuid().nullable().optional(),
  defaultServiceItemId: z.string().uuid().nullable().optional(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  dependsOnTemplateCodes: z.array(z.string()),
  isActive: z.boolean(),
  sortOrder: z.number(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectTaskTemplate = z.infer<typeof projectTaskTemplateSchema>;

// ============================================================================
// Project Task Schemas
// ============================================================================

/**
 * Schema for creating a project task
 */
export const createProjectTaskSchema = z.object({
  projectId: uuidSchema,
  milestoneId: optionalUuidSchema,
  templateId: optionalUuidSchema,
  parentTaskId: optionalUuidSchema,
  taskCode: z.string().max(50).optional(),
  taskName: z.string().min(1, 'Task name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  priority: ProjectTaskPriorityEnum.default('MEDIUM'),
  status: ProjectTaskStatusEnum.default('NOT_STARTED'),
  activityCodeId: optionalUuidSchema,
  serviceItemId: optionalUuidSchema,
  assigneeId: optionalUuidSchema,
  reviewerId: optionalUuidSchema,
  dueDate: dateStringSchema.optional(),
  estimatedHours: z.number().positive().max(10000).optional(),
  dependsOnTaskIds: z.array(uuidSchema).optional(),
  workNotes: z.string().max(5000).optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isBillable: z.boolean().default(true),
  billingRate: z.number().positive().optional(),
  billingType: TaskBillingTypeEnum.default('flat_fee'),
  flatFeeAmount: z.number().positive().optional(),
  metadata: metadataSchema,
});

export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

/**
 * Schema for updating a project task
 */
export const updateProjectTaskSchema = z.object({
  milestoneId: nullableOptionalUuidSchema,
  parentTaskId: nullableOptionalUuidSchema,
  taskCode: z.string().max(50).optional(),
  taskName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  priority: ProjectTaskPriorityEnum.optional(),
  status: ProjectTaskStatusEnum.optional(),
  activityCodeId: nullableOptionalUuidSchema,
  serviceItemId: nullableOptionalUuidSchema,
  assigneeId: nullableOptionalUuidSchema,
  reviewerId: nullableOptionalUuidSchema,
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().positive().max(10000).nullable().optional(),
  actualHours: z.number().positive().max(10000).nullable().optional(),
  dependsOnTaskIds: z.array(uuidSchema).optional(),
  blockedReason: z.string().max(500).nullable().optional(),
  workNotes: z.string().max(5000).nullable().optional(),
  reviewNotes: z.string().max(5000).nullable().optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isBillable: z.boolean().optional(),
  billingRate: z.number().positive().nullable().optional(),
  billingType: TaskBillingTypeEnum.optional(),
  flatFeeAmount: z.number().positive().nullable().optional(),
  metadata: metadataSchema,
});

export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;

/**
 * Project task filters schema
 */
export const projectTaskFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    milestoneId: z.string().uuid().optional(),
    status: z.union([ProjectTaskStatusEnum, z.array(ProjectTaskStatusEnum)]).optional(),
    priority: z.union([ProjectTaskPriorityEnum, z.array(ProjectTaskPriorityEnum)]).optional(),
    assigneeId: z.string().uuid().optional(),
    category: z.string().optional(),
    isBillable: z.boolean().optional(),
    dueBefore: dateStringSchema.optional(),
    dueAfter: dateStringSchema.optional(),
    search: z.string().optional(),
  })
  .optional();

export type ProjectTaskFilters = z.infer<typeof projectTaskFiltersSchema>;

/**
 * Project task list input schema
 */
export const projectTaskListInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    orderBy: z.enum(['sortOrder', 'dueDate', 'taskName', 'createdAt', 'priority']).optional(),
    orderDirection: sortDirectionSchema.optional(),
    filters: projectTaskFiltersSchema,
  })
  .optional();

export type ProjectTaskListInput = z.infer<typeof projectTaskListInputSchema>;

/**
 * Full project task schema
 */
export const projectTaskSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  milestoneId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  organizationId: uuidSchema,
  taskCode: z.string().nullable().optional(),
  taskName: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  priority: ProjectTaskPriorityEnum,
  status: ProjectTaskStatusEnum,
  activityCodeId: z.string().uuid().nullable().optional(),
  serviceItemId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  actualHours: z.number().nullable().optional(),
  dependsOnTaskIds: z.array(z.string()),
  blockedReason: z.string().nullable().optional(),
  workNotes: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  attachmentUrls: z.array(z.string()),
  sortOrder: z.number(),
  isBillable: z.boolean(),
  billingRate: z.number().nullable().optional(),
  billingType: TaskBillingTypeEnum.nullable().optional(),
  flatFeeAmount: z.number().nullable().optional(),
  invoicedAt: z.date().nullable().optional(),
  invoiceLineId: z.string().uuid().nullable().optional(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectTask = z.infer<typeof projectTaskSchema>;

// ============================================================================
// Project Template Schemas
// ============================================================================

/**
 * Milestone definition schema for project templates
 */
export const milestoneDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetDayOffset: z.number().int().min(0).optional(),
  isBillingMilestone: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type MilestoneDefinition = z.infer<typeof milestoneDefinitionSchema>;

/**
 * Schema for creating a project template
 */
export const createProjectTemplateSchema = z.object({
  subsidiaryId: optionalUuidSchema,
  templateCode: z.string().min(1, 'Template code is required').max(50),
  templateName: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional(),
  projectType: z.string().max(50).optional(),
  defaultMilestones: z.array(milestoneDefinitionSchema).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  metadata: metadataSchema,
});

export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;

/**
 * Schema for updating a project template
 */
export const updateProjectTemplateSchema = z.object({
  templateCode: z.string().min(1).max(50).optional(),
  templateName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  projectType: z.string().max(50).nullable().optional(),
  defaultMilestones: z.array(milestoneDefinitionSchema).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: metadataSchema,
});

export type UpdateProjectTemplateInput = z.infer<typeof updateProjectTemplateSchema>;

/**
 * Project template filters schema
 */
export const projectTemplateFiltersSchema = z
  .object({
    projectType: z.string().optional(),
    isActive: z.boolean().optional(),
    subsidiaryId: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .optional();

export type ProjectTemplateFilters = z.infer<typeof projectTemplateFiltersSchema>;

/**
 * Project template list input schema
 */
export const projectTemplateListInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    orderBy: z.enum(['sortOrder', 'templateCode', 'templateName', 'createdAt']).optional(),
    orderDirection: sortDirectionSchema.optional(),
    filters: projectTemplateFiltersSchema,
  })
  .optional();

export type ProjectTemplateListInput = z.infer<typeof projectTemplateListInputSchema>;

/**
 * Full project template schema
 */
export const projectTemplateSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  subsidiaryId: z.string().uuid().nullable().optional(),
  templateCode: z.string(),
  templateName: z.string(),
  description: z.string().nullable().optional(),
  projectType: z.string().nullable().optional(),
  defaultMilestones: z.array(milestoneDefinitionSchema),
  isActive: z.boolean(),
  sortOrder: z.number(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectTemplate = z.infer<typeof projectTemplateSchema>;

// ============================================================================
// Project Template Task Schemas
// ============================================================================

/**
 * Schema for adding a task to a project template
 */
export const createProjectTemplateTaskSchema = z.object({
  projectTemplateId: uuidSchema,
  taskTemplateId: uuidSchema,
  milestoneName: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
  metadata: metadataSchema,
});

export type CreateProjectTemplateTaskInput = z.infer<typeof createProjectTemplateTaskSchema>;

/**
 * Full project template task schema
 */
export const projectTemplateTaskSchema = z.object({
  id: uuidSchema,
  projectTemplateId: uuidSchema,
  taskTemplateId: uuidSchema,
  milestoneName: z.string().nullable().optional(),
  sortOrder: z.number(),
  metadata: metadataSchema,
  createdAt: z.date(),
});

export type ProjectTemplateTask = z.infer<typeof projectTemplateTaskSchema>;

// ============================================================================
// Bulk Operation Schemas
// ============================================================================

/**
 * Schema for bulk updating task status
 */
export const projectTaskBulkStatusUpdateSchema = z.object({
  taskIds: uuidArraySchema,
  status: ProjectTaskStatusEnum,
  blockedReason: z.string().max(500).optional(),
});

export type ProjectTaskBulkStatusUpdateInput = z.infer<typeof projectTaskBulkStatusUpdateSchema>;

/**
 * Schema for generating tasks from templates
 */
export const projectTaskGenerateFromTemplatesSchema = z.object({
  projectId: uuidSchema,
  milestoneId: optionalUuidSchema,
  taskTemplateIds: uuidArraySchema,
  defaultAssigneeId: optionalUuidSchema,
  dueDateOffset: z.number().int().min(0).optional(),
});

export type ProjectTaskGenerateFromTemplatesInput = z.infer<typeof projectTaskGenerateFromTemplatesSchema>;

/**
 * Schema for instantiating a project from a template
 */
export const instantiateProjectFromTemplateSchema = z.object({
  projectId: uuidSchema,
  projectTemplateId: uuidSchema,
  startDate: dateStringSchema.optional(),
  defaultAssigneeId: optionalUuidSchema,
});

export type InstantiateProjectFromTemplateInput = z.infer<typeof instantiateProjectFromTemplateSchema>;

/**
 * Schema for updating task status
 */
export const updateTaskStatusSchema = z.object({
  status: ProjectTaskStatusEnum,
  blockedReason: z.string().max(500).optional(),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

// ============================================================================
// Summary and Progress Types
// ============================================================================

/**
 * Project task summary interface
 */
export interface ProjectTaskSummary {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  notStartedTasks: number;
  completionPercentage: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

/**
 * Milestone progress interface
 */
export interface MilestoneProgress {
  milestoneId: string;
  milestoneName: string;
  status: ProjectMilestoneStatus;
  targetDate?: string | null;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}

/**
 * Assignee workload interface
 */
export interface AssigneeWorkload {
  assigneeId: string;
  assigneeName?: string;
  totalTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalEstimatedHours: number;
}

// ============================================================================
// Task with Relations
// ============================================================================

/**
 * Project task with relations interface
 */
export interface ProjectTaskWithRelations extends ProjectTask {
  project?: {
    id: string;
    name: string;
    projectCode: string;
  };
  milestone?: {
    id: string;
    name: string;
  } | null;
  assignee?: {
    id: string;
    name: string;
  } | null;
  reviewer?: {
    id: string;
    name: string;
  } | null;
  activityCode?: {
    id: string;
    code: string;
    description?: string;
  } | null;
  serviceItem?: {
    id: string;
    itemCode: string;
    name: string;
  } | null;
  childTasks?: ProjectTask[];
  dependsOnTasks?: ProjectTask[];
}
