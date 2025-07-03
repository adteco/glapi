import { z } from 'zod';
import { authenticatedProcedure, publicProcedure, router } from '../trpc';
import { OrganizationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const organizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  stytchOrgId: z.string().min(1),
  settings: z.record(z.any()).optional(),
});

export const organizationsRouter = router({
  list: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new OrganizationService(ctx.serviceContext);
    // TODO: Implement list organizations
    return [];
  }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new OrganizationService(ctx.serviceContext);
      return service.getOrganizationById(input.id);
    }),

  getDefault: authenticatedProcedure.query(async ({ ctx }) => {
    // Return the current user's organization
    return {
      id: ctx.organizationId,
      name: 'Current Organization',
      subdomain: 'current',
    };
  }),

  create: authenticatedProcedure
    .input(organizationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OrganizationService(ctx.serviceContext);
      return service.createOrganization(input);
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string(),
        data: organizationSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new OrganizationService(ctx.serviceContext);
      return service.updateOrganization(input.id, input.data);
    }),

  lookup: publicProcedure
    .input(z.object({ subdomain: z.string() }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement subdomain lookup
      return {
        id: 'org-123',
        name: 'Example Org',
        subdomain: input.subdomain,
      };
    }),
});