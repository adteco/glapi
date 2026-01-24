import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { savedReportConfigsRepository, REPORT_TYPES } from '@glapi/database';
import { TRPCError } from '@trpc/server';

// Report type enum
const reportTypeSchema = z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW_STATEMENT']);

// Configuration JSON schema
const reportConfigSchema = z.object({
  // Dimension filters
  subsidiaryId: z.string().uuid().nullable().optional(),
  departmentIds: z.array(z.string().uuid()).optional(),
  classIds: z.array(z.string().uuid()).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  // Display options
  includeInactive: z.boolean().optional(),
  showAccountHierarchy: z.boolean().optional(),
  showZeroBalances: z.boolean().optional(),
  includeYTD: z.boolean().optional(),
  // Comparison settings
  compareWithPriorPeriod: z.boolean().optional(),
  // Export preferences
  defaultExportFormat: z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']).optional(),
});

export const savedReportConfigsRouter = router({
  /**
   * List all saved report configs for the current user
   */
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(100).default(50),
        orderBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
        orderDirection: z.enum(['asc', 'desc']).optional(),
        reportType: reportTypeSchema.optional(),
        isDefault: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input = {} }) => {
      // Get entity ID from user context (for RLS)
      // Note: In a real app, we'd need to map clerk userId to entity UUID
      const userId = ctx.user!.id;

      return savedReportConfigsRepository.findAll(
        ctx.organizationId,
        userId,
        {
          page: input.page,
          limit: input.limit,
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
          filters: {
            reportType: input.reportType,
            isDefault: input.isDefault,
          },
        }
      );
    }),

  /**
   * Get a specific saved report config by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      const config = await savedReportConfigsRepository.findById(
        input.id,
        ctx.organizationId,
        userId
      );

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved report configuration not found',
        });
      }

      return config;
    }),

  /**
   * Get the default config for a specific report type
   */
  getDefault: protectedProcedure
    .input(z.object({ reportType: reportTypeSchema }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      return savedReportConfigsRepository.findDefault(
        ctx.organizationId,
        userId,
        input.reportType
      );
    }),

  /**
   * Create a new saved report config
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        reportType: reportTypeSchema,
        config: reportConfigSchema,
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      // Check if name already exists
      const nameExists = await savedReportConfigsRepository.nameExists(
        ctx.organizationId,
        userId,
        input.reportType,
        input.name
      );

      if (nameExists) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A configuration named "${input.name}" already exists for this report type`,
        });
      }

      return savedReportConfigsRepository.create({
        organizationId: ctx.organizationId,
        userId,
        name: input.name,
        reportType: input.reportType,
        config: input.config,
        isDefault: input.isDefault,
      });
    }),

  /**
   * Update an existing saved report config
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        config: reportConfigSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      // If name is being changed, check for duplicates
      if (input.name) {
        const existing = await savedReportConfigsRepository.findById(
          input.id,
          ctx.organizationId,
          userId
        );

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Saved report configuration not found',
          });
        }

        const nameExists = await savedReportConfigsRepository.nameExists(
          ctx.organizationId,
          userId,
          existing.reportType as 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW_STATEMENT',
          input.name,
          input.id
        );

        if (nameExists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `A configuration named "${input.name}" already exists for this report type`,
          });
        }
      }

      const result = await savedReportConfigsRepository.update(
        input.id,
        ctx.organizationId,
        userId,
        {
          name: input.name,
          config: input.config,
          isDefault: input.isDefault,
        }
      );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved report configuration not found',
        });
      }

      return result;
    }),

  /**
   * Delete a saved report config
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      const deleted = await savedReportConfigsRepository.delete(
        input.id,
        ctx.organizationId,
        userId
      );

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved report configuration not found',
        });
      }

      return { success: true };
    }),

  /**
   * Set a config as the default for its report type
   */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;

      const result = await savedReportConfigsRepository.setAsDefault(
        input.id,
        ctx.organizationId,
        userId
      );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved report configuration not found',
        });
      }

      return result;
    }),
});
