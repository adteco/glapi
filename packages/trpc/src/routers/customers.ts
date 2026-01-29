import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { CustomerService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const customerSchema = z.object({
  companyName: z.string().min(1),
  customerId: z.string().min(1).optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional().nullable(),
  shippingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional().nullable(),
  parentCustomerId: z.string().uuid().optional().nullable(),
  taxId: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  creditLimit: z.number().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
});

export const customersRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      const result = await service.listCustomers(
        { page: 1, limit: 100 },
        'companyName',
        'asc'
      );
      return result.data;
    }),

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      const customer = await service.getCustomerById(input.id);
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }
      
      return customer;
    }),

  create: authenticatedProcedure
    .input(customerSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      const { shippingAddress, taxId, paymentTerms, creditLimit, ...customerData } = input;
      
      return service.createCustomer({
        ...customerData,
        organizationId: ctx.organizationId,
        contactEmail: customerData.contactEmail || undefined,
        contactPhone: customerData.contactPhone || undefined,
        billingAddress: customerData.billingAddress || undefined,
        parentCustomerId: customerData.parentCustomerId || undefined,
      });
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: customerSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      const { shippingAddress, taxId, paymentTerms, creditLimit, ...customerData } = input.data;
      
      const dataToUpdate = {
        ...customerData,
        contactEmail: customerData.contactEmail === null ? undefined : customerData.contactEmail,
        contactPhone: customerData.contactPhone === null ? undefined : customerData.contactPhone,
        billingAddress: customerData.billingAddress === null ? undefined : customerData.billingAddress,
        parentCustomerId: customerData.parentCustomerId === null ? undefined : customerData.parentCustomerId,
      };
      
      const updated = await service.updateCustomer(input.id, dataToUpdate);
      
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }
      
      return updated;
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      await service.deleteCustomer(input.id);
      return { success: true };
    }),

  getChildren: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      const customer = await service.getCustomerById(input.id);
      
      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }
      
      // TODO: Implement child customers
      return [];
    }),

  getWarehouseAssignments: authenticatedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext, { db: ctx.db });
      // TODO: Implement warehouse assignments
      return [];
    }),
});