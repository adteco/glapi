/**
 * tRPC Router for Communication Events
 *
 * Provides API endpoints for managing communication events (sent emails):
 * - List and filter sent emails
 * - Send ad-hoc emails
 * - View event details with tracking history
 * - Resend failed emails
 * - Get delivery statistics and analytics
 */

import { z } from 'zod';
import { router, authenticatedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  db,
  communicationEvents,
  emailTemplates,
  emailTrackingEvents,
  emailUnsubscribes,
  emailSuppressionList,
  generateEmailHash,
  eq,
  and,
  asc,
  desc,
  gte,
  lte,
  ilike,
  or,
  sql,
  inArray,
} from '@glapi/database';
import type {
  CommunicationEvent,
  CommunicationStatus,
  CommunicationEventType,
  TemplateVariable,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const communicationStatusEnum = z.enum([
  'pending',
  'queued',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'failed',
  'cancelled',
]);

const communicationEventTypeEnum = z.enum([
  'ad_hoc',
  'workflow',
  'transactional',
  'notification',
  'bulk',
]);

const entityTypeEnum = z.enum([
  'customer',
  'employee',
  'contact',
  'lead',
  'prospect',
  'vendor',
]);

const listEventsSchema = z.object({
  status: z.array(communicationStatusEnum).optional(),
  eventType: communicationEventTypeEnum.optional(),
  entityType: entityTypeEnum.optional(),
  entityId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  toEmail: z.string().email().optional(),
  search: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['createdAt', 'sentAt', 'toEmail', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const sendAdHocEmailSchema = z.object({
  // Recipient
  toEmail: z.string().email(),
  toName: z.string().max(255).optional(),
  entityType: entityTypeEnum.optional(),
  entityId: z.string().uuid().optional(),
  // Sender (optional overrides)
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(255).optional(),
  replyTo: z.string().email().optional(),
  // Content - either templateId or direct content
  templateId: z.string().uuid().optional(),
  templateVariables: z.record(z.unknown()).optional(),
  subject: z.string().max(500).optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  // Scheduling
  scheduledAt: z.date().optional(),
});

const getStatsSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Substitute variables in template content
 */
function substituteVariables(
  content: string,
  variables: Record<string, unknown>
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}

/**
 * Check if email is suppressed
 */
async function isEmailSuppressed(
  organizationId: string,
  email: string
): Promise<{ suppressed: boolean; reason?: string }> {
  const emailHash = generateEmailHash(email);

  // Check suppression list
  const suppression = await db.query.emailSuppressionList.findFirst({
    where: and(
      eq(emailSuppressionList.organizationId, organizationId),
      eq(emailSuppressionList.emailHash, emailHash),
      or(
        eq(emailSuppressionList.isPermanent, true),
        sql`${emailSuppressionList.expiresAt} > now()`
      )
    ),
  });

  if (suppression) {
    return { suppressed: true, reason: suppression.reason };
  }

  // Check unsubscribes
  const unsubscribe = await db.query.emailUnsubscribes.findFirst({
    where: and(
      eq(emailUnsubscribes.organizationId, organizationId),
      eq(emailUnsubscribes.emailHash, emailHash),
      eq(emailUnsubscribes.isActive, true)
    ),
  });

  if (unsubscribe) {
    return { suppressed: true, reason: `unsubscribed_${unsubscribe.reason}` };
  }

  return { suppressed: false };
}

// =============================================================================
// Router
// =============================================================================

export const communicationEventsRouter = router({
  // ===========================================================================
  // List Events
  // ===========================================================================

  list: authenticatedProcedure
    .input(listEventsSchema)
    .query(async ({ ctx, input }) => {
      const {
        status,
        eventType,
        entityType,
        entityId,
        templateId,
        toEmail,
        search,
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(communicationEvents.organizationId, ctx.organizationId)];

      if (status && status.length > 0) {
        conditions.push(inArray(communicationEvents.status, status));
      }

      if (eventType) {
        conditions.push(eq(communicationEvents.eventType, eventType));
      }

      if (entityType) {
        conditions.push(eq(communicationEvents.entityType, entityType));
      }

      if (entityId) {
        conditions.push(eq(communicationEvents.entityId, entityId));
      }

      if (templateId) {
        conditions.push(eq(communicationEvents.templateId, templateId));
      }

      if (toEmail) {
        conditions.push(eq(communicationEvents.toEmail, toEmail.toLowerCase()));
      }

      if (search) {
        conditions.push(
          or(
            ilike(communicationEvents.toEmail, `%${search}%`),
            ilike(communicationEvents.toName, `%${search}%`),
            ilike(communicationEvents.subject, `%${search}%`)
          )!
        );
      }

      if (dateFrom) {
        conditions.push(gte(communicationEvents.createdAt, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(communicationEvents.createdAt, dateTo));
      }

      // Build order by
      const orderByColumn =
        sortBy === 'createdAt'
          ? communicationEvents.createdAt
          : sortBy === 'sentAt'
          ? communicationEvents.sentAt
          : sortBy === 'toEmail'
          ? communicationEvents.toEmail
          : communicationEvents.status;

      const orderBy = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

      // Get events with template info
      const events = await db.query.communicationEvents.findMany({
        where: and(...conditions),
        orderBy: [orderBy],
        limit,
        offset,
        with: {
          template: {
            columns: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communicationEvents)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      return {
        items: events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // ===========================================================================
  // Get Single Event with Tracking History
  // ===========================================================================

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const event = await db.query.communicationEvents.findFirst({
        where: and(
          eq(communicationEvents.id, input.id),
          eq(communicationEvents.organizationId, ctx.organizationId)
        ),
        with: {
          template: true,
        },
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Communication event not found',
        });
      }

      // Get tracking events
      const trackingHistory = await db.query.emailTrackingEvents.findMany({
        where: eq(emailTrackingEvents.communicationEventId, input.id),
        orderBy: [asc(emailTrackingEvents.occurredAt)],
      });

      return {
        ...event,
        trackingHistory,
      };
    }),

  // ===========================================================================
  // Send Ad-Hoc Email
  // ===========================================================================

  sendAdHoc: authenticatedProcedure
    .input(sendAdHocEmailSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if email is suppressed
      const suppressionCheck = await isEmailSuppressed(
        ctx.organizationId,
        input.toEmail
      );

      if (suppressionCheck.suppressed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Email is suppressed: ${suppressionCheck.reason}`,
        });
      }

      // Resolve template if provided
      let subject: string;
      let htmlBody: string;
      let textBody: string | null = null;
      let fromEmail: string;
      let fromName: string | null = null;
      let replyTo: string | null = null;

      if (input.templateId) {
        const template = await db.query.emailTemplates.findFirst({
          where: and(
            eq(emailTemplates.id, input.templateId),
            eq(emailTemplates.organizationId, ctx.organizationId)
          ),
        });

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Email template not found',
          });
        }

        if (template.status !== 'active') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot send with a non-active template',
          });
        }

        const variables = input.templateVariables ?? {};
        subject = substituteVariables(template.subject, variables);
        htmlBody = substituteVariables(template.htmlBody, variables);
        textBody = template.textBody
          ? substituteVariables(template.textBody, variables)
          : null;
        fromEmail = input.fromEmail ?? template.fromEmail ?? process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
        fromName = input.fromName ?? template.fromName ?? null;
        replyTo = input.replyTo ?? template.replyTo ?? null;
      } else {
        // Use direct content
        if (!input.subject || !input.htmlBody) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either templateId or subject and htmlBody must be provided',
          });
        }

        subject = input.subject;
        htmlBody = input.htmlBody;
        textBody = input.textBody ?? null;
        fromEmail = input.fromEmail ?? process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
        fromName = input.fromName ?? null;
        replyTo = input.replyTo ?? null;
      }

      // Create the communication event
      const [event] = await db
        .insert(communicationEvents)
        .values({
          organizationId: ctx.organizationId,
          entityType: input.entityType,
          entityId: input.entityId,
          toEmail: input.toEmail.toLowerCase(),
          toName: input.toName,
          fromEmail,
          fromName,
          replyTo,
          subject,
          htmlBody,
          textBody,
          templateId: input.templateId,
          templateVariables: input.templateVariables,
          eventType: 'ad_hoc',
          status: input.scheduledAt ? 'pending' : 'queued',
          scheduledAt: input.scheduledAt,
          queuedAt: input.scheduledAt ? null : new Date(),
          createdBy: ctx.user?.entityId ?? null,
        })
        .returning();

      // TODO: Actually send the email via SES
      // For now, just mark as queued

      return event;
    }),

  // ===========================================================================
  // Resend Failed Email
  // ===========================================================================

  resend: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.query.communicationEvents.findFirst({
        where: and(
          eq(communicationEvents.id, input.id),
          eq(communicationEvents.organizationId, ctx.organizationId)
        ),
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Communication event not found',
        });
      }

      if (!['failed', 'bounced'].includes(event.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only resend failed or bounced emails',
        });
      }

      // Check if email is now suppressed
      const suppressionCheck = await isEmailSuppressed(
        ctx.organizationId,
        event.toEmail
      );

      if (suppressionCheck.suppressed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Email is now suppressed: ${suppressionCheck.reason}`,
        });
      }

      // Reset the event for retry
      const [updated] = await db
        .update(communicationEvents)
        .set({
          status: 'queued',
          queuedAt: new Date(),
          retryCount: event.retryCount + 1,
          errorCode: null,
          errorMessage: null,
          sentAt: null,
          deliveredAt: null,
          bouncedAt: null,
          failedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(communicationEvents.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Cancel Scheduled Email
  // ===========================================================================

  cancel: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.query.communicationEvents.findFirst({
        where: and(
          eq(communicationEvents.id, input.id),
          eq(communicationEvents.organizationId, ctx.organizationId)
        ),
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Communication event not found',
        });
      }

      if (!['pending', 'queued'].includes(event.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only cancel pending or queued emails',
        });
      }

      const [updated] = await db
        .update(communicationEvents)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(communicationEvents.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Get Delivery Statistics
  // ===========================================================================

  getStats: authenticatedProcedure
    .input(getStatsSchema.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(communicationEvents.organizationId, ctx.organizationId)];

      if (input?.dateFrom) {
        conditions.push(gte(communicationEvents.createdAt, input.dateFrom));
      }

      if (input?.dateTo) {
        conditions.push(lte(communicationEvents.createdAt, input.dateTo));
      }

      // Get counts by status
      const statusCounts = await db
        .select({
          status: communicationEvents.status,
          count: sql<number>`count(*)::int`,
        })
        .from(communicationEvents)
        .where(and(...conditions))
        .groupBy(communicationEvents.status);

      // Calculate totals and rates
      const stats = {
        total: 0,
        pending: 0,
        queued: 0,
        sending: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
        cancelled: 0,
      };

      for (const row of statusCounts) {
        stats.total += row.count;
        stats[row.status as keyof typeof stats] = row.count;
      }

      // Calculate rates
      const sentTotal = stats.sent + stats.delivered + stats.opened + stats.clicked + stats.bounced + stats.complained;
      const deliveryRate = sentTotal > 0 ? ((stats.delivered + stats.opened + stats.clicked) / sentTotal) * 100 : 0;
      const openRate = sentTotal > 0 ? ((stats.opened + stats.clicked) / sentTotal) * 100 : 0;
      const clickRate = sentTotal > 0 ? (stats.clicked / sentTotal) * 100 : 0;
      const bounceRate = sentTotal > 0 ? (stats.bounced / sentTotal) * 100 : 0;
      const complaintRate = sentTotal > 0 ? (stats.complained / sentTotal) * 100 : 0;

      return {
        ...stats,
        rates: {
          delivery: Math.round(deliveryRate * 100) / 100,
          open: Math.round(openRate * 100) / 100,
          click: Math.round(clickRate * 100) / 100,
          bounce: Math.round(bounceRate * 100) / 100,
          complaint: Math.round(complaintRate * 100) / 100,
        },
      };
    }),

  // ===========================================================================
  // Get Analytics Trends
  // ===========================================================================

  getAnalytics: authenticatedProcedure
    .input(getStatsSchema)
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, groupBy } = input;

      const dateFormat =
        groupBy === 'day'
          ? 'YYYY-MM-DD'
          : groupBy === 'week'
          ? 'IYYY-IW'
          : 'YYYY-MM';

      const conditions = [eq(communicationEvents.organizationId, ctx.organizationId)];

      if (dateFrom) {
        conditions.push(gte(communicationEvents.createdAt, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(communicationEvents.createdAt, dateTo));
      }

      // Get trends grouped by date and status
      const trends = await db
        .select({
          period: sql<string>`to_char(${communicationEvents.createdAt}, ${dateFormat})`,
          status: communicationEvents.status,
          count: sql<number>`count(*)::int`,
        })
        .from(communicationEvents)
        .where(and(...conditions))
        .groupBy(
          sql`to_char(${communicationEvents.createdAt}, ${dateFormat})`,
          communicationEvents.status
        )
        .orderBy(sql`to_char(${communicationEvents.createdAt}, ${dateFormat})`);

      // Transform into a more useful format
      const periodMap = new Map<string, Record<string, number>>();

      for (const row of trends) {
        if (!periodMap.has(row.period)) {
          periodMap.set(row.period, {
            total: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            complained: 0,
            failed: 0,
          });
        }

        const periodStats = periodMap.get(row.period)!;
        periodStats.total += row.count;
        if (row.status in periodStats) {
          periodStats[row.status] = row.count;
        }
      }

      return {
        groupBy,
        data: Array.from(periodMap.entries()).map(([period, stats]) => ({
          period,
          ...stats,
        })),
      };
    }),

  // ===========================================================================
  // Get Communication History for Entity
  // ===========================================================================

  getEntityHistory: authenticatedProcedure
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await db.query.communicationEvents.findMany({
        where: and(
          eq(communicationEvents.organizationId, ctx.organizationId),
          eq(communicationEvents.entityType, input.entityType),
          eq(communicationEvents.entityId, input.entityId)
        ),
        orderBy: [desc(communicationEvents.createdAt)],
        limit: input.limit,
        with: {
          template: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return events;
    }),

  // ===========================================================================
  // Check Email Suppression Status
  // ===========================================================================

  checkSuppression: authenticatedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      return isEmailSuppressed(ctx.organizationId, input.email);
    }),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CommunicationEventsRouter = typeof communicationEventsRouter;
