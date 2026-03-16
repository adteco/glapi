import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { EmployeeService } from '@glapi/api-service';
import { createReadOnlyAIMeta, createWriteAIMeta, createDeleteAIMeta } from '../ai-meta';

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
  limit: z.number().min(1).max(1000).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const employeesRouter = router({
  list: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('list_employees', 'Search and list employee records', {
      scopes: ['employees', 'hr', 'global'],
      permissions: ['read:employees'],
    }) })
    .input(employeeQuerySchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      const { page = 1, limit = 10, search, isActive } = input;

      return await service.listEmployees({
        page,
        limit,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
        search,
        isActive,
      });
    }),

  getById: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_employee', 'Get a single employee by ID', {
      scopes: ['employees', 'hr', 'global'],
      permissions: ['read:employees'],
    }) })
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      return await service.findById(input.id);
    }),

  // Alias for getById (some components use get)
  get: authenticatedProcedure
    .meta({ ai: createReadOnlyAIMeta('get_employee_by_id', 'Get a single employee by ID (alias)', {
      scopes: ['employees', 'hr'],
      permissions: ['read:employees'],
    }) })
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      return await service.findById(input.id);
    }),

  create: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('create_employee', 'Create a new employee record', {
      scopes: ['employees', 'hr'],
      permissions: ['write:employees'],
      riskLevel: 'MEDIUM',
    }) })
    .input(employeeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      return await service.createEmployee({
        ...input,
        status: 'active' as const,
        entityTypes: ['Employee'] as const,
      });
    }),

  update: authenticatedProcedure
    .meta({ ai: createWriteAIMeta('update_employee', 'Update an existing employee record', {
      scopes: ['employees', 'hr'],
      permissions: ['write:employees'],
      riskLevel: 'MEDIUM',
    }) })
    .input(z.object({
      id: z.string(),
      data: updateEmployeeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      return await service.updateEmployee(input.id, input.data);
    }),

  delete: authenticatedProcedure
    .meta({ ai: createDeleteAIMeta('delete_employee', 'Delete an employee record', {
      scopes: ['employees'],
      permissions: ['delete:employees'],
      riskLevel: 'HIGH',
    }) })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new EmployeeService(ctx.serviceContext, { db: ctx.db });
      return await service.delete(input.id);
    }),
});