import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ProjectTaskService } from '@glapi/api-service';
import {
  createProjectTaskInputSchema,
  updateProjectTaskInputSchema,
  projectTaskFiltersSchema,
} from '@glapi/api-service';

const taskListInputSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  orderBy: z.enum(['sortOrder', 'startDate', 'endDate', 'createdAt']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  filters: projectTaskFiltersSchema,
});

export const projectTasksRouter = router({
  list: authenticatedProcedure
    .input(taskListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.listTasks(
        input.projectId,
        {
          page: input.page,
          limit: input.limit,
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
        },
        input.filters || {}
      );
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTaskById(input.id);
    }),

  getTree: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filters: projectTaskFiltersSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.getTaskTree(input.projectId, input.filters || {});
    }),

  create: authenticatedProcedure
    .input(createProjectTaskInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.createTask(input);
    }),

  update: authenticatedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateProjectTaskInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.updateTask(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectTaskService(ctx.serviceContext);
      return service.deleteTask(input.id);
    }),
});
