import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { EmployeeService } from '@glapi/api-service';

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  entityId: z.string().optional(),
  isActive: z.boolean().default(true),
  legalName: z.string().optional(),
  taxIdNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  metadata: z.object({
    employee_id: z.string().optional(),
    department: z.string().optional(),
    position: z.string().optional(),
    hire_date: z.string().optional(),
    salary: z.number().optional(),
    status: z.string().optional(),
  }).optional(),
});

const updateEmployeeSchema = employeeSchema.partial();

const employeeQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const employeesRouter = router({
  list: authenticatedProcedure
    .input(employeeQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new EmployeeService();
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listEmployees(ctx.user.organizationId, {
        page,
        limit,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
        search,
        isActive,
      });
    }),

  getById: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new EmployeeService();
      return await service.findById(input.id, ctx.user.organizationId);
    }),

  // Alias for getById (some components use get)
  get: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new EmployeeService();
      return await service.findById(input.id, ctx.user.organizationId);
    }),

  create: authenticatedProcedure
    .input(employeeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService();
      return await service.createEmployee(ctx.user.organizationId, {
        ...input,
        status: 'active' as const,
        entityTypes: ['Employee'] as const,
      });
    }),

  update: authenticatedProcedure
    .input(z.object({
      id: z.string(),
      data: updateEmployeeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService();
      return await service.updateEmployee(input.id, ctx.user.organizationId, input.data);
    }),

  delete: authenticatedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService();
      return await service.delete(input.id, ctx.user.organizationId);
    }),
});