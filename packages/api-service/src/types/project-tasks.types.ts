import { z } from 'zod';

export const projectTaskStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);

export const projectTaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const projectTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().nullable(),
  projectCostCodeId: z.string().uuid().nullable(),
  taskCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectTaskStatusEnum,
  priority: projectTaskPriorityEnum,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  durationDays: z.number().int().nullable(),
  percentComplete: z.string(),
  isMilestone: z.boolean(),
  sortOrder: z.number().int(),
  assignedEntityId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectTask = z.infer<typeof projectTaskSchema>;

export type ProjectTaskNode = ProjectTask & {
  children: ProjectTaskNode[];
};

export const createProjectTaskInputSchema = z.object({
  projectId: z.string().uuid(),
  taskCode: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  status: projectTaskStatusEnum.optional(),
  priority: projectTaskPriorityEnum.optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  projectCostCodeId: z.string().uuid().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationDays: z.number().int().min(0).optional(),
  percentComplete: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Percent complete must be numeric')
    .optional(),
  isMilestone: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  assignedEntityId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateProjectTaskInputSchema = createProjectTaskInputSchema.partial().extend({
  projectId: z.string().uuid().optional(),
  taskCode: z.string().min(1).max(100).optional(),
});

export type CreateProjectTaskInput = z.infer<typeof createProjectTaskInputSchema>;
export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskInputSchema>;

export const projectTaskFiltersSchema = z.object({
  status: z.union([projectTaskStatusEnum, z.array(projectTaskStatusEnum)]).optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  assignedEntityId: z.string().uuid().optional(),
  search: z.string().optional(),
}).optional();

export type ProjectTaskFilters = z.infer<typeof projectTaskFiltersSchema>;
