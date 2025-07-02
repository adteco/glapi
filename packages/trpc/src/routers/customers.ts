import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { CustomerService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

const customerSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
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
  isActive: z.boolean().default(true),
});

export const customersRouter = router({
  list: authenticatedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext);
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
      const service = new CustomerService(ctx.serviceContext);
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
      const service = new CustomerService(ctx.serviceContext);
      return service.createCustomer(input);
    }),

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: customerSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext);
      const updated = await service.updateCustomer(input.id, input.data);
      
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
      const service = new CustomerService(ctx.serviceContext);
      await service.deleteCustomer(input.id);
      return { success: true };
    }),

  getChildren: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new CustomerService(ctx.serviceContext);
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
      const service = new CustomerService(ctx.serviceContext);
      // TODO: Implement warehouse assignments
      return [];
    }),
});