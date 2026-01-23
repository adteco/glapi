/**
 * Project Tasks Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports project task types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export all project task related types from centralized package
export {
  // Enums
  ProjectTaskStatusEnum,
  type ProjectTaskStatus,
  ProjectTaskPriorityEnum,
  type ProjectTaskPriority,
  ProjectMilestoneStatusEnum,
  type ProjectMilestoneStatus,

  // Status transitions
  VALID_TASK_STATUS_TRANSITIONS,
  VALID_MILESTONE_STATUS_TRANSITIONS,

  // Milestone schemas
  createProjectMilestoneSchema,
  type CreateProjectMilestoneInput,
  updateProjectMilestoneSchema,
  type UpdateProjectMilestoneInput,
  projectMilestoneFiltersSchema,
  type ProjectMilestoneFilters,
  projectMilestoneListInputSchema,
  type ProjectMilestoneListInput,
  projectMilestoneSchema,
  type ProjectMilestone,

  // Task template schemas
  createProjectTaskTemplateSchema,
  type CreateProjectTaskTemplateInput,
  updateProjectTaskTemplateSchema,
  type UpdateProjectTaskTemplateInput,
  projectTaskTemplateFiltersSchema,
  type ProjectTaskTemplateFilters,
  projectTaskTemplateListInputSchema,
  type ProjectTaskTemplateListInput,
  projectTaskTemplateSchema,
  type ProjectTaskTemplate,

  // Task schemas
  createProjectTaskSchema,
  type CreateProjectTaskInput,
  updateProjectTaskSchema,
  type UpdateProjectTaskInput,
  projectTaskFiltersSchema,
  type ProjectTaskFilters,
  projectTaskListInputSchema,
  type ProjectTaskListInput,
  projectTaskSchema,
  type ProjectTask,
  updateTaskStatusSchema,
  type UpdateTaskStatusInput,

  // Project template schemas
  milestoneDefinitionSchema,
  type MilestoneDefinition,
  createProjectTemplateSchema,
  type CreateProjectTemplateInput,
  updateProjectTemplateSchema,
  type UpdateProjectTemplateInput,
  projectTemplateFiltersSchema,
  type ProjectTemplateFilters,
  projectTemplateListInputSchema,
  type ProjectTemplateListInput,
  projectTemplateSchema,
  type ProjectTemplate,

  // Template task schemas
  createProjectTemplateTaskSchema,
  type CreateProjectTemplateTaskInput,
  projectTemplateTaskSchema,
  type ProjectTemplateTask,

  // Bulk operation schemas
  projectTaskBulkStatusUpdateSchema,
  type ProjectTaskBulkStatusUpdateInput,
  projectTaskGenerateFromTemplatesSchema,
  type ProjectTaskGenerateFromTemplatesInput,
  instantiateProjectFromTemplateSchema,
  type InstantiateProjectFromTemplateInput,

  // Summary types
  type ProjectTaskSummary,
  type MilestoneProgress,
  type AssigneeWorkload,

  // Task with relations
  type ProjectTaskWithRelations,
} from '@glapi/types';
