import { z } from 'zod';
import { authenticatedProcedure, publicProcedure, router } from '../trpc';
import { OrganizationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const organizationSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  settings: z.object({
    currency: z.string().default('USD'),
    timezone: z.string().default('America/New_York'),
    fiscalYearEnd: z.string().optional(),
  }).optional(),
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