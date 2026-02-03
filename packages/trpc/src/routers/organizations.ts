import { z } from 'zod';
import { authenticatedProcedure, publicProcedure, router } from '../trpc';
import { OrganizationService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';
import { createReadOnlyAIMeta, createWriteAIMeta } from '../ai-meta';

const organizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  stytchOrgId: z.string().min(1),
  settings: z.record(z.any()).optional(),
});

export const organizationsRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_organizations', 'List all organizations', {
      scopes: ['organizations', 'admin', 'global'],
      permissions: ['read:organizations'],
    }) })
    .query(async ({ ctx }) => {
    const service = new OrganizationService(ctx.serviceContext);
    // TODO: Implement list organizations
    return [];
  }),

  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_organization', 'Get a single organization by ID', {
      scopes: ['organizations', 'admin', 'global'],
      permissions: ['read:organizations'],
    }) })
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new OrganizationService(ctx.serviceContext);
      return service.getOrganizationById(input.id);
    }),

  getDefault: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_default_organization', 'Get the current users default organization', {
      scopes: ['organizations', 'global'],
      permissions: ['read:organizations'],
    }) })
    .query(async ({ ctx }) => {
    // Return the current user's organization
    return {
      id: ctx.organizationId,
      name: 'Current Organization',
      subdomain: 'current',
    };
  }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_organization', 'Create a new organization', {
      scopes: ['organizations', 'admin'],
      permissions: ['write:organizations'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
    .input(organizationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OrganizationService(ctx.serviceContext);
      return service.createOrganization(input);
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_organization', 'Update an existing organization', {
      scopes: ['organizations', 'admin'],
      permissions: ['write:organizations'],
      riskLevel: 'HIGH',
      minimumRole: 'admin',
    }) })
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

  /**
   * Provision a new organization from Clerk with a default subsidiary
   *
   * This endpoint is used when a new organization signs up via Clerk
   * (including satellite domains like AdTeco). It creates the organization
   * record and a default subsidiary.
   */
  provisionFromClerk: publicProcedure
    .input(
      z.object({
        clerkOrgId: z.string().min(1, 'Clerk organization ID is required'),
        name: z.string().min(1, 'Organization name is required'),
        slug: z.string().optional(),
        defaultSubsidiaryName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const service = new OrganizationService({});
      try {
        return await service.provisionFromClerk(input);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Find or provision organization from Clerk
   *
   * If the organization exists, returns it. Otherwise provisions a new one.
   * Useful for automatic provisioning during authentication flow.
   */
  findOrProvisionFromClerk: publicProcedure
    .input(
      z.object({
        clerkOrgId: z.string().min(1),
        name: z.string().min(1),
        slug: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const service = new OrganizationService({});
      return await service.findOrProvisionFromClerk(input);
    }),
});