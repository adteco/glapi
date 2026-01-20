import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { DeliveryConnectorsService } from '@glapi/api-service';
import { TRPCError } from '@trpc/server';

// Schema definitions
const deliveryStatusSchema = z.enum(['pending', 'processing', 'delivered', 'failed', 'dead_letter']);
const deliveryTypeSchema = z.enum(['email', 'webhook', 'sftp', 's3']);

const deliveryConfigSchema = z.object({
  type: deliveryTypeSchema,

  // Email config
  emailRecipients: z.array(z.string().email()).optional(),
  emailSubject: z.string().optional(),
  emailBodyTemplate: z.string().optional(),
  emailBodyHtml: z.string().optional(),
  attachmentFilename: z.string().optional(),

  // Webhook config
  webhookUrl: z.string().url().optional(),
  webhookMethod: z.enum(['POST', 'PUT']).optional(),
  webhookHeaders: z.record(z.string()).optional(),
  webhookTimeout: z.number().min(1000).max(120000).optional(),

  // SFTP config (future)
  sftpHost: z.string().optional(),
  sftpPort: z.number().optional(),
  sftpPath: z.string().optional(),
  sftpCredentialsId: z.string().uuid().optional(),
  sftpFilename: z.string().optional(),

  // S3 config (future)
  s3Bucket: z.string().optional(),
  s3Key: z.string().optional(),
  s3Region: z.string().optional(),
  s3ContentType: z.string().optional(),
});

// Helper to map service errors to TRPC errors
function handleServiceError(error: any): never {
  if (error.code === 'NOT_FOUND') {
    throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
  }
  if (error.code === 'INVALID_STATUS') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'INVALID_DELIVERY_CONFIG' || error.code === 'UNSUPPORTED_DELIVERY_TYPE') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
  }
  if (error.code === 'UPDATE_FAILED') {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }
  throw error;
}

export const deliveryQueueRouter = router({
  // ============================================================================
  // Delivery Queue Management
  // ============================================================================

  // Queue a new delivery
  queue: authenticatedProcedure
    .input(z.object({
      reportScheduleId: z.string().uuid().optional(),
      jobExecutionId: z.string().uuid().optional(),
      deliveryType: deliveryTypeSchema,
      deliveryConfig: deliveryConfigSchema,
      reportType: z.string(),
      outputFormat: z.string(),
      outputLocation: z.string().optional(),
      outputSizeBytes: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);

      try {
        return await service.queueDelivery(input);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Queue multiple deliveries
  queueMultiple: authenticatedProcedure
    .input(z.object({
      base: z.object({
        reportScheduleId: z.string().uuid().optional(),
        jobExecutionId: z.string().uuid().optional(),
        reportType: z.string(),
        outputFormat: z.string(),
        outputLocation: z.string().optional(),
        outputSizeBytes: z.number().optional(),
      }),
      deliveryConfigs: z.array(z.object({
        type: deliveryTypeSchema,
        config: deliveryConfigSchema,
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      return service.queueMultipleDeliveries(input.base, input.deliveryConfigs);
    }),

  // Get a delivery by ID
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);

      const delivery = await service.getDelivery(input.id);
      if (!delivery) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Delivery not found'
        });
      }

      return delivery;
    }),

  // Get delivery attempts (audit log)
  getAttempts: authenticatedProcedure
    .input(z.object({ deliveryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);

      try {
        return await service.getDeliveryAttempts(input.deliveryId);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // List deliveries with filters
  list: authenticatedProcedure
    .input(z.object({
      status: z.union([
        deliveryStatusSchema,
        z.array(deliveryStatusSchema)
      ]).optional(),
      deliveryType: deliveryTypeSchema.optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      return service.listDeliveries(input);
    }),

  // ============================================================================
  // Dead Letter Queue Management
  // ============================================================================

  // Get dead letter items
  getDeadLetterItems: authenticatedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(100),
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      return service.getDeadLetterItems(input.limit ?? 100);
    }),

  // Retry a dead letter item
  retryDeadLetter: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);

      try {
        return await service.retryDeadLetter(input.id);
      } catch (error: any) {
        handleServiceError(error);
      }
    }),

  // Bulk retry dead letter items
  retryDeadLetterBulk: authenticatedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);

      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const id of input.ids) {
        try {
          await service.retryDeadLetter(id);
          results.push({ id, success: true });
        } catch (error: any) {
          results.push({ id, success: false, error: error.message });
        }
      }

      return {
        total: input.ids.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  // Get delivery queue statistics
  getStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      return service.getStats();
    }),

  // Get combined scheduler and delivery stats (for dashboard)
  getDashboardStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const deliveryService = new DeliveryConnectorsService(ctx.serviceContext);

      // Import dynamically to avoid circular dependency
      const { ReportSchedulerService } = await import('@glapi/api-service');
      const schedulerService = new ReportSchedulerService(ctx.serviceContext);

      const [deliveryStats, schedulerStats] = await Promise.all([
        deliveryService.getStats(),
        schedulerService.getStats(),
      ]);

      return {
        schedules: schedulerStats,
        deliveries: deliveryStats,
        summary: {
          totalActiveSchedules: schedulerStats.active,
          totalPendingDeliveries: deliveryStats.pending + deliveryStats.failed,
          totalDeadLetter: deliveryStats.deadLetter,
          healthStatus: deliveryStats.deadLetter > 10 ? 'warning' :
                        deliveryStats.deadLetter > 0 ? 'attention' : 'healthy',
        },
      };
    }),

  // ============================================================================
  // Utility Endpoints
  // ============================================================================

  // Validate a delivery config
  validateConfig: authenticatedProcedure
    .input(z.object({
      type: deliveryTypeSchema,
      config: deliveryConfigSchema,
    }))
    .query(async ({ ctx, input }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      const errors = service.validateDeliveryConfig(input.type, input.config);

      return {
        valid: errors.length === 0,
        errors,
      };
    }),

  // Get supported delivery types
  getSupportedTypes: authenticatedProcedure
    .query(async ({ ctx }) => {
      const service = new DeliveryConnectorsService(ctx.serviceContext);
      return service.getSupportedDeliveryTypes();
    }),
});
