import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { BankDepositService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Zod schemas for validation
const reconcileDepositSchema = z.object({
  depositId: z.string().uuid(),
  bankStatementDate: z.string(),
  bankStatementRef: z.string().min(1),
  bankStatementAmount: z.string().refine(val => !isNaN(parseFloat(val)), {
    message: 'Amount must be a valid number',
  }),
});

const resolveExceptionSchema = z.object({
  exceptionId: z.string().uuid(),
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

const depositFiltersSchema = z.object({
  status: z.enum(['OPEN', 'SUBMITTED', 'RECONCILED', 'CANCELLED']).optional(),
  reconciliationStatus: z.enum(['PENDING', 'MATCHED', 'EXCEPTION']).optional(),
  subsidiaryId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

const exceptionFiltersSchema = z.object({
  depositId: z.string().uuid().optional(),
  status: z.enum(['EXCEPTION', 'RESOLVED']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

export const bankDepositsRouter = router({
  // ==========================================================================
  // Deposit Queries
  // ==========================================================================

  /**
   * List bank deposits with filters and pagination
   */
  list: authenticatedProcedure
    .input(depositFiltersSchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new BankDepositService(ctx.serviceContext);
      return service.listDeposits(
        { page: input.page ?? 1, limit: input.limit ?? 50 },
        {
          status: input.status,
          reconciliationStatus: input.reconciliationStatus,
          subsidiaryId: input.subsidiaryId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }
      );
    }),

  /**
   * Get a specific deposit by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new BankDepositService(ctx.serviceContext);
      const deposit = await service.getDepositById(input.id);

      if (!deposit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deposit not found',
        });
      }

      return deposit;
    }),

  /**
   * Get deposits ready for reconciliation (SUBMITTED status)
   */
  pendingReconciliation: authenticatedProcedure
    .input(
      z
        .object({
          subsidiaryId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new BankDepositService(ctx.serviceContext);
      return service.getDepositsForReconciliation(input.subsidiaryId);
    }),

  /**
   * Get deposit batch summary (counts and totals by status)
   */
  summary: authenticatedProcedure
    .input(
      z
        .object({
          subsidiaryId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new BankDepositService(ctx.serviceContext);
      return service.getDepositBatchSummary(input.subsidiaryId);
    }),

  /**
   * Get GL posting summary for a deposit
   */
  glSummary: authenticatedProcedure
    .input(z.object({ depositId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new BankDepositService(ctx.serviceContext);

      try {
        return await service.getDepositGLSummary(input.depositId);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // ==========================================================================
  // Reconciliation Actions
  // ==========================================================================

  /**
   * Reconcile a deposit against bank statement
   */
  reconcile: authenticatedProcedure.input(reconcileDepositSchema).mutation(async ({ ctx, input }) => {
    const service = new BankDepositService(ctx.serviceContext);

    try {
      return await service.reconcileDeposit(input);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
      if (error.code === 'INVALID_STATUS' || error.code === 'ALREADY_RECONCILED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
      throw error;
    }
  }),

  // ==========================================================================
  // Exception Queries
  // ==========================================================================

  /**
   * List reconciliation exceptions
   */
  listExceptions: authenticatedProcedure
    .input(exceptionFiltersSchema.optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new BankDepositService(ctx.serviceContext);
      return service.listExceptions({ page: input.page ?? 1, limit: input.limit ?? 50 }, {
        depositId: input.depositId,
        status: input.status,
      });
    }),

  /**
   * Get a specific exception by ID
   */
  getException: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new BankDepositService(ctx.serviceContext);
      const exception = await service.getExceptionById(input.id);

      if (!exception) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Exception not found',
        });
      }

      return exception;
    }),

  /**
   * Resolve a reconciliation exception
   */
  resolveException: authenticatedProcedure.input(resolveExceptionSchema).mutation(async ({ ctx, input }) => {
    const service = new BankDepositService(ctx.serviceContext);

    try {
      return await service.resolveException(input);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
      if (error.code === 'ALREADY_RESOLVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
      throw error;
    }
  }),

  // ==========================================================================
  // Dashboard Stats
  // ==========================================================================

  /**
   * Get reconciliation dashboard statistics
   */
  dashboardStats: authenticatedProcedure
    .input(
      z
        .object({
          subsidiaryId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input = {} }) => {
      const service = new BankDepositService(ctx.serviceContext);

      // Get batch summary
      const summary = await service.getDepositBatchSummary(input.subsidiaryId);

      // Get pending exceptions count
      const exceptions = await service.listExceptions({ page: 1, limit: 1 }, { status: 'EXCEPTION' });

      // Get pending reconciliation deposits
      const pendingDeposits = await service.getDepositsForReconciliation(input.subsidiaryId);

      return {
        // Deposit counts by status
        openDeposits: summary.openCount,
        submittedDeposits: summary.submittedCount,
        reconciledDeposits: summary.reconciledCount,

        // Amounts
        openAmount: summary.openAmount,
        submittedAmount: summary.submittedAmount,
        reconciledAmount: summary.reconciledAmount,

        // Pending work
        pendingReconciliationCount: pendingDeposits.length,
        pendingReconciliationAmount: pendingDeposits.reduce(
          (sum, d) => sum + parseFloat(d.totalAmount || '0'),
          0
        ),

        // Exceptions
        openExceptionsCount: exceptions.total,

        // Totals
        totalDeposits: summary.openCount + summary.submittedCount + summary.reconciledCount,
        totalAmount:
          parseFloat(summary.openAmount || '0') +
          parseFloat(summary.submittedAmount || '0') +
          parseFloat(summary.reconciledAmount || '0'),
      };
    }),
});
