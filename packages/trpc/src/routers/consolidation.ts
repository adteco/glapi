import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import {
  ConsolidationService,
  ConsolidationEngine,
  ConsolidationReportingService,
} from '@glapi/api-service';

// ==========================================
// Zod Schemas
// ==========================================

const paginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

const consolidationMethodSchema = z.enum(['FULL', 'PROPORTIONAL', 'EQUITY']);
const translationMethodSchema = z.enum(['CURRENT_RATE', 'TEMPORAL', 'MONETARY_NONMONETARY']);
const eliminationTypeSchema = z.enum([
  'INTERCOMPANY_RECEIVABLE',
  'INTERCOMPANY_REVENUE',
  'INTERCOMPANY_INVESTMENT',
  'INTERCOMPANY_DIVIDEND',
  'UNREALIZED_PROFIT',
  'CUSTOM',
]);

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  parentSubsidiaryId: z.string().uuid(),
  consolidationCurrencyId: z.string().uuid(),
  translationMethod: translationMethodSchema.optional(),
  effectiveDate: z.string(),
  endDate: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
  translationMethod: translationMethodSchema.optional(),
  isActive: z.boolean().optional(),
  endDate: z.string().optional().nullable(),
});

const addMemberSchema = z.object({
  groupId: z.string().uuid(),
  subsidiaryId: z.string().uuid(),
  ownershipPercent: z.number().min(0).max(100),
  votingPercent: z.number().min(0).max(100).optional(),
  consolidationMethod: consolidationMethodSchema.optional(),
  minorityInterestAccountId: z.string().uuid().optional(),
  effectiveDate: z.string(),
  endDate: z.string().optional(),
  sequenceNumber: z.number().int().min(1).optional(),
});

const updateMemberSchema = z.object({
  ownershipPercent: z.number().min(0).max(100).optional(),
  votingPercent: z.number().min(0).max(100).optional(),
  consolidationMethod: consolidationMethodSchema.optional(),
  minorityInterestAccountId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  sequenceNumber: z.number().int().min(1).optional(),
});

const createEliminationRuleSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  eliminationType: eliminationTypeSchema,
  sequenceNumber: z.number().int().min(1).optional(),
  sourceSubsidiaryId: z.string().uuid().optional(),
  sourceAccountId: z.string().uuid().optional(),
  sourceAccountPattern: z.string().max(100).optional(),
  targetSubsidiaryId: z.string().uuid().optional(),
  targetAccountId: z.string().uuid().optional(),
  targetAccountPattern: z.string().max(100).optional(),
  eliminationDebitAccountId: z.string().uuid().optional(),
  eliminationCreditAccountId: z.string().uuid().optional(),
  isAutomatic: z.boolean().optional(),
  effectiveDate: z.string(),
  endDate: z.string().optional(),
});

const updateEliminationRuleSchema = createEliminationRuleSchema.partial().omit({ groupId: true });

const upsertExchangeRateSchema = z.object({
  fromCurrencyId: z.string().uuid(),
  toCurrencyId: z.string().uuid(),
  periodId: z.string().uuid(),
  rateType: z.enum(['CURRENT', 'HISTORICAL', 'AVERAGE']),
  rate: z.number().positive(),
  rateDate: z.string(),
  source: z.string().optional(),
});

const createIntercompanyMappingSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sourceAccountId: z.string().uuid(),
  targetAccountId: z.string().uuid(),
  eliminationDebitAccountId: z.string().uuid().optional(),
  eliminationCreditAccountId: z.string().uuid().optional(),
});

const updateIntercompanyMappingSchema = createIntercompanyMappingSchema.partial();

// ==========================================
// Router
// ==========================================

export const consolidationRouter = router({
  // ==========================================
  // Consolidation Groups
  // ==========================================

  /**
   * List all consolidation groups
   */
  listGroups: authenticatedProcedure
    .input(
      z
        .object({
          pagination: paginationSchema.optional(),
          filters: z
            .object({
              isActive: z.boolean().optional(),
              parentSubsidiaryId: z.string().uuid().optional(),
            })
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.listConsolidationGroups(
        input?.pagination ?? {},
        input?.filters ?? {}
      );
    }),

  /**
   * Get a single consolidation group by ID
   */
  getGroup: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.getConsolidationGroupById(input.id);
    }),

  /**
   * Create a new consolidation group
   */
  createGroup: authenticatedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.createConsolidationGroup({
        organizationId: ctx.organizationId,
        name: input.name,
        code: input.code,
        description: input.description,
        parentSubsidiaryId: input.parentSubsidiaryId,
        consolidationCurrencyId: input.consolidationCurrencyId,
        translationMethod: input.translationMethod,
        effectiveDate: input.effectiveDate,
        endDate: input.endDate,
      });
    }),

  /**
   * Update an existing consolidation group
   */
  updateGroup: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateGroupSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      // Convert null to undefined for service compatibility
      return service.updateConsolidationGroup(input.id, {
        ...input.data,
        description: input.data.description ?? undefined,
        endDate: input.data.endDate ?? undefined,
      });
    }),

  /**
   * Delete a consolidation group
   */
  deleteGroup: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      await service.deleteConsolidationGroup(input.id);
      return { success: true };
    }),

  // ==========================================
  // Group Members
  // ==========================================

  /**
   * Get members of a consolidation group
   */
  getGroupMembers: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        filters: z
          .object({
            isActive: z.boolean().optional(),
            consolidationMethod: consolidationMethodSchema.optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.getGroupMembers(input.groupId, input.filters ?? {});
    }),

  /**
   * Add a subsidiary to a consolidation group
   */
  addGroupMember: authenticatedProcedure
    .input(addMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.addGroupMember({
        groupId: input.groupId,
        subsidiaryId: input.subsidiaryId,
        ownershipPercent: input.ownershipPercent,
        votingPercent: input.votingPercent,
        consolidationMethod: input.consolidationMethod,
        minorityInterestAccountId: input.minorityInterestAccountId,
        effectiveDate: input.effectiveDate,
        endDate: input.endDate,
        sequenceNumber: input.sequenceNumber,
      });
    }),

  /**
   * Update a group member
   */
  updateGroupMember: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateMemberSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      // Convert null to undefined for service compatibility
      return service.updateGroupMember(input.id, {
        ...input.data,
        minorityInterestAccountId: input.data.minorityInterestAccountId ?? undefined,
        endDate: input.data.endDate ?? undefined,
      });
    }),

  /**
   * Remove a subsidiary from a consolidation group
   */
  removeGroupMember: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      await service.removeGroupMember(input.id);
      return { success: true };
    }),

  // ==========================================
  // Elimination Rules
  // ==========================================

  /**
   * Get elimination rules for a group
   */
  getEliminationRules: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        filters: z
          .object({
            isActive: z.boolean().optional(),
            eliminationType: eliminationTypeSchema.optional(),
            isAutomatic: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.getEliminationRules(input.groupId, input.filters ?? {});
    }),

  /**
   * Create an elimination rule
   */
  createEliminationRule: authenticatedProcedure
    .input(createEliminationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.createEliminationRule({
        groupId: input.groupId,
        name: input.name,
        description: input.description,
        eliminationType: input.eliminationType,
        sequenceNumber: input.sequenceNumber,
        sourceSubsidiaryId: input.sourceSubsidiaryId,
        sourceAccountId: input.sourceAccountId,
        sourceAccountPattern: input.sourceAccountPattern,
        targetSubsidiaryId: input.targetSubsidiaryId,
        targetAccountId: input.targetAccountId,
        targetAccountPattern: input.targetAccountPattern,
        eliminationDebitAccountId: input.eliminationDebitAccountId,
        eliminationCreditAccountId: input.eliminationCreditAccountId,
        isAutomatic: input.isAutomatic,
        effectiveDate: input.effectiveDate,
        endDate: input.endDate,
      });
    }),

  /**
   * Update an elimination rule
   */
  updateEliminationRule: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateEliminationRuleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.updateEliminationRule(input.id, input.data);
    }),

  /**
   * Delete an elimination rule
   */
  deleteEliminationRule: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      await service.deleteEliminationRule(input.id);
      return { success: true };
    }),

  // ==========================================
  // Exchange Rates
  // ==========================================

  /**
   * Get exchange rates for a period
   */
  getExchangeRates: authenticatedProcedure
    .input(z.object({ periodId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.getExchangeRatesByPeriod(input.periodId);
    }),

  /**
   * Create or update an exchange rate
   */
  upsertExchangeRate: authenticatedProcedure
    .input(upsertExchangeRateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.upsertExchangeRate({
        organizationId: ctx.organizationId,
        fromCurrencyId: input.fromCurrencyId,
        toCurrencyId: input.toCurrencyId,
        periodId: input.periodId,
        rateType: input.rateType,
        rate: input.rate,
        rateDate: input.rateDate,
        source: input.source,
      });
    }),

  // ==========================================
  // Intercompany Mappings
  // ==========================================

  /**
   * Get all intercompany mappings
   */
  getIntercompanyMappings: authenticatedProcedure.query(async ({ ctx }) => {
    const service = new ConsolidationService(ctx.serviceContext);
    return service.getIntercompanyMappings();
  }),

  /**
   * Create an intercompany mapping
   */
  createIntercompanyMapping: authenticatedProcedure
    .input(createIntercompanyMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.createIntercompanyMapping({
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description,
        sourceAccountId: input.sourceAccountId,
        targetAccountId: input.targetAccountId,
        eliminationDebitAccountId: input.eliminationDebitAccountId,
        eliminationCreditAccountId: input.eliminationCreditAccountId,
      });
    }),

  /**
   * Update an intercompany mapping
   */
  updateIntercompanyMapping: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateIntercompanyMappingSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.updateIntercompanyMapping(input.id, input.data);
    }),

  /**
   * Delete an intercompany mapping
   */
  deleteIntercompanyMapping: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      await service.deleteIntercompanyMapping(input.id);
      return { success: true };
    }),

  // ==========================================
  // Dashboard / Summary
  // ==========================================

  /**
   * Get summary data for a consolidation group
   */
  getGroupSummary: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationService(ctx.serviceContext);
      return service.getGroupSummary(input.groupId, input.periodId);
    }),

  // ==========================================
  // Consolidation Runs (Engine)
  // ==========================================

  /**
   * Execute a consolidation run
   */
  runConsolidation: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        runType: z.enum(['PRELIMINARY', 'FINAL']),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const engine = new ConsolidationEngine(ctx.serviceContext);
      return engine.runConsolidation({
        groupId: input.groupId,
        periodId: input.periodId,
        runType: input.runType,
        description: input.description,
      });
    }),

  /**
   * Reverse a consolidation run
   */
  reverseConsolidationRun: authenticatedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const engine = new ConsolidationEngine(ctx.serviceContext);
      return engine.reverseConsolidationRun(input.runId);
    }),

  /**
   * Get details of a consolidation run
   */
  getConsolidationRunDetails: authenticatedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const engine = new ConsolidationEngine(ctx.serviceContext);
      return engine.getConsolidationRunDetails(input.runId);
    }),

  /**
   * List consolidation runs for a group/period
   */
  listConsolidationRuns: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        filters: z
          .object({
            status: z
              .enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REVERSED'])
              .optional(),
            runType: z.enum(['PRELIMINARY', 'FINAL']).optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const engine = new ConsolidationEngine(ctx.serviceContext);
      return engine.listConsolidationRuns(
        input.groupId,
        input.periodId,
        input.filters ?? {}
      );
    }),

  // ==========================================
  // Consolidated Financial Reports
  // ==========================================

  /**
   * Get consolidated balance sheet
   */
  getConsolidatedBalanceSheet: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        includeBreakdown: z.boolean().optional(),
        bookFilter: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getConsolidatedBalanceSheet({
        groupId: input.groupId,
        periodId: input.periodId,
        runId: input.runId,
        includeBreakdown: input.includeBreakdown,
        bookFilter: input.bookFilter,
      });
    }),

  /**
   * Get consolidated income statement
   */
  getConsolidatedIncomeStatement: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        includeBreakdown: z.boolean().optional(),
        bookFilter: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getConsolidatedIncomeStatement({
        groupId: input.groupId,
        periodId: input.periodId,
        runId: input.runId,
        includeBreakdown: input.includeBreakdown,
        bookFilter: input.bookFilter,
      });
    }),

  /**
   * Get consolidated trial balance
   */
  getConsolidatedTrialBalance: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        includeBreakdown: z.boolean().optional(),
        bookFilter: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getConsolidatedTrialBalance({
        groupId: input.groupId,
        periodId: input.periodId,
        runId: input.runId,
        includeBreakdown: input.includeBreakdown,
        bookFilter: input.bookFilter,
      });
    }),

  /**
   * Get elimination summary for a run
   */
  getEliminationSummary: authenticatedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getEliminationSummary(input.runId);
    }),

  /**
   * Get translation summary for a run
   */
  getTranslationSummary: authenticatedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getTranslationSummary(input.runId);
    }),

  /**
   * Get available books/entities for filtering
   */
  getAvailableBooks: authenticatedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.getAvailableBooks(input.groupId);
    }),

  /**
   * Export consolidation data
   */
  exportConsolidationData: authenticatedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        periodId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        format: z.enum(['json', 'csv']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new ConsolidationReportingService(ctx.serviceContext);
      return service.exportConsolidationData({
        groupId: input.groupId,
        periodId: input.periodId,
        runId: input.runId,
      }, input.format);
    }),
});
