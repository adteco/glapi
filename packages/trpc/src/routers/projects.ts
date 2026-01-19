import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { ProjectService } from '@glapi/api-service';
import {
  createProjectInputSchema,
  updateProjectInputSchema,
  projectFiltersSchema,
  projectParticipantInputSchema,
  projectAddressInputSchema,
} from '@glapi/api-service';

const projectListInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  orderBy: z.enum(['name', 'projectCode', 'startDate', 'createdAt']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  filters: projectFiltersSchema,
}).optional();

export const projectsRouter = router({
  list: authenticatedProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.listProjects(
        {
          page: input?.page,
          limit: input?.limit,
          orderBy: input?.orderBy,
          orderDirection: input?.orderDirection,
        },
        input?.filters || {}
      );
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.getProjectById(input.id);
    }),

  create: authenticatedProcedure
    .input(createProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.createProject(input);
    }),

  update: authenticatedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateProjectInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.updateProject(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.deleteProject(input.id);
    }),

  listParticipants: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.listParticipants(input.projectId);
    }),

  upsertParticipant: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        data: projectParticipantInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.upsertParticipant(input.projectId, input.data);
    }),

  removeParticipant: authenticatedProcedure
    .input(z.object({ participantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.removeParticipant(input.participantId);
    }),

  listAddresses: authenticatedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.listAddresses(input.projectId);
    }),

  upsertAddress: authenticatedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        data: projectAddressInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.upsertAddress(input.projectId, input.data);
    }),

  deleteAddress: authenticatedProcedure
    .input(z.object({ addressId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ProjectService(ctx.serviceContext);
      return service.deleteAddress(input.addressId);
    }),
});
