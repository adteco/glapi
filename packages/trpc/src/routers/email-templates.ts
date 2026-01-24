/**
 * tRPC Router for Email Templates
 *
 * Provides API endpoints for managing email templates:
 * - CRUD operations
 * - Template preview with variable substitution
 * - Variable extraction and validation
 * - Template duplication
 */

import { z } from 'zod';
import { router, authenticatedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  db,
  emailTemplates,
  eq,
  and,
  asc,
  desc,
  ilike,
  or,
  sql,
} from '@glapi/database';
import type {
  EmailTemplate,
  EmailTemplateStatus,
  EmailTemplateCategory,
  TemplateVariable,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const templateStatusEnum = z.enum(['draft', 'active', 'archived']);
const templateCategoryEnum = z.enum([
  'transactional',
  'marketing',
  'notification',
  'workflow',
  'custom',
]);

const variableTypeEnum = z.enum([
  'string',
  'number',
  'date',
  'boolean',
  'currency',
  'url',
  'email',
]);

const templateVariableSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: variableTypeEnum,
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().max(500).optional(),
  format: z.string().max(50).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  category: templateCategoryEnum.optional().default('custom'),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  variables: z.array(templateVariableSchema).optional().default([]),
  status: templateStatusEnum.optional().default('draft'),
  previewData: z.record(z.unknown()).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email().max(255).optional(),
  replyTo: z.string().email().max(255).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: templateCategoryEnum.optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().nullable().optional(),
  variables: z.array(templateVariableSchema).optional(),
  status: templateStatusEnum.optional(),
  previewData: z.record(z.unknown()).nullable().optional(),
  fromName: z.string().max(255).nullable().optional(),
  fromEmail: z.string().email().max(255).nullable().optional(),
  replyTo: z.string().email().max(255).nullable().optional(),
});

const listTemplatesSchema = z.object({
  status: templateStatusEnum.optional(),
  category: templateCategoryEnum.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const previewTemplateSchema = z.object({
  templateId: z.string().uuid().optional(),
  subject: z.string().optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  variables: z.record(z.unknown()),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract variables from template content using {{variable}} syntax
 */
function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1].trim());
  }

  return Array.from(variables);
}

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
      return match; // Keep the placeholder if no value
    }
    return String(value);
  });
}

/**
 * Verify template ownership
 */
async function verifyTemplateOwnership(
  templateId: string,
  organizationId: string
): Promise<EmailTemplate> {
  const template = await db.query.emailTemplates.findFirst({
    where: and(
      eq(emailTemplates.id, templateId),
      eq(emailTemplates.organizationId, organizationId)
    ),
  });

  if (!template) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Email template not found',
    });
  }

  return template;
}

/**
 * Generate a unique slug based on name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// =============================================================================
// Router
// =============================================================================

export const emailTemplatesRouter = router({
  // ===========================================================================
  // List Templates
  // ===========================================================================

  list: authenticatedProcedure
    .input(listTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const { status, category, search, page, limit, sortBy, sortOrder } = input;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(emailTemplates.organizationId, ctx.organizationId)];

      if (status) {
        conditions.push(eq(emailTemplates.status, status));
      }

      if (category) {
        conditions.push(eq(emailTemplates.category, category));
      }

      if (search) {
        conditions.push(
          or(
            ilike(emailTemplates.name, `%${search}%`),
            ilike(emailTemplates.subject, `%${search}%`),
            ilike(emailTemplates.description, `%${search}%`)
          )!
        );
      }

      // Build order by
      const orderByColumn =
        sortBy === 'name'
          ? emailTemplates.name
          : sortBy === 'createdAt'
          ? emailTemplates.createdAt
          : emailTemplates.updatedAt;

      const orderBy = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

      // Get templates with pagination
      const templates = await db.query.emailTemplates.findMany({
        where: and(...conditions),
        orderBy: [orderBy],
        limit,
        offset,
      });

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailTemplates)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      return {
        items: templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // ===========================================================================
  // Get Single Template
  // ===========================================================================

  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return verifyTemplateOwnership(input.id, ctx.organizationId);
    }),

  // ===========================================================================
  // Get Template by Slug
  // ===========================================================================

  getBySlug: authenticatedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await db.query.emailTemplates.findFirst({
        where: and(
          eq(emailTemplates.organizationId, ctx.organizationId),
          eq(emailTemplates.slug, input.slug)
        ),
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Email template not found',
        });
      }

      return template;
    }),

  // ===========================================================================
  // Create Template
  // ===========================================================================

  create: authenticatedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate slug
      const existingSlug = await db.query.emailTemplates.findFirst({
        where: and(
          eq(emailTemplates.organizationId, ctx.organizationId),
          eq(emailTemplates.slug, input.slug)
        ),
      });

      if (existingSlug) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A template with this slug already exists',
        });
      }

      const [template] = await db
        .insert(emailTemplates)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          category: input.category,
          subject: input.subject,
          htmlBody: input.htmlBody,
          textBody: input.textBody,
          variables: input.variables as TemplateVariable[],
          status: input.status,
          previewData: input.previewData,
          fromName: input.fromName,
          fromEmail: input.fromEmail,
          replyTo: input.replyTo,
          createdBy: ctx.user?.id,
          updatedBy: ctx.user?.id,
        })
        .returning();

      return template;
    }),

  // ===========================================================================
  // Update Template
  // ===========================================================================

  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTemplateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTemplateOwnership(input.id, ctx.organizationId);

      // Check for duplicate slug if slug is being updated
      if (input.data.slug) {
        const existingSlug = await db.query.emailTemplates.findFirst({
          where: and(
            eq(emailTemplates.organizationId, ctx.organizationId),
            eq(emailTemplates.slug, input.data.slug)
          ),
        });

        if (existingSlug && existingSlug.id !== input.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A template with this slug already exists',
          });
        }
      }

      const [updated] = await db
        .update(emailTemplates)
        .set({
          ...input.data,
          variables: input.data.variables as TemplateVariable[] | undefined,
          updatedBy: ctx.user?.id,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Delete Template
  // ===========================================================================

  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyTemplateOwnership(input.id, ctx.organizationId);

      await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));

      return { success: true };
    }),

  // ===========================================================================
  // Duplicate Template
  // ===========================================================================

  duplicate: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const original = await verifyTemplateOwnership(input.id, ctx.organizationId);

      // Generate slug if not provided
      const slug = input.slug ?? generateSlug(input.name);

      // Check for duplicate slug
      const existingSlug = await db.query.emailTemplates.findFirst({
        where: and(
          eq(emailTemplates.organizationId, ctx.organizationId),
          eq(emailTemplates.slug, slug)
        ),
      });

      if (existingSlug) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A template with this slug already exists',
        });
      }

      const [duplicate] = await db
        .insert(emailTemplates)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          slug,
          description: original.description,
          category: original.category,
          subject: original.subject,
          htmlBody: original.htmlBody,
          textBody: original.textBody,
          variables: original.variables,
          status: 'draft', // Always start as draft
          previewData: original.previewData,
          fromName: original.fromName,
          fromEmail: original.fromEmail,
          replyTo: original.replyTo,
          createdBy: ctx.user?.id,
          updatedBy: ctx.user?.id,
        })
        .returning();

      return duplicate;
    }),

  // ===========================================================================
  // Preview Template
  // ===========================================================================

  preview: authenticatedProcedure
    .input(previewTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      let subject: string;
      let htmlBody: string;
      let textBody: string | null = null;

      if (input.templateId) {
        // Use existing template
        const template = await verifyTemplateOwnership(
          input.templateId,
          ctx.organizationId
        );
        subject = input.subject ?? template.subject;
        htmlBody = input.htmlBody ?? template.htmlBody;
        textBody = input.textBody ?? template.textBody;
      } else {
        // Use provided content
        if (!input.subject || !input.htmlBody) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Either templateId or subject and htmlBody must be provided',
          });
        }
        subject = input.subject;
        htmlBody = input.htmlBody;
        textBody = input.textBody ?? null;
      }

      // Substitute variables
      const renderedSubject = substituteVariables(subject, input.variables);
      const renderedHtmlBody = substituteVariables(htmlBody, input.variables);
      const renderedTextBody = textBody
        ? substituteVariables(textBody, input.variables)
        : null;

      return {
        subject: renderedSubject,
        htmlBody: renderedHtmlBody,
        textBody: renderedTextBody,
      };
    }),

  // ===========================================================================
  // Validate/Extract Variables
  // ===========================================================================

  extractVariables: authenticatedProcedure
    .input(
      z.object({
        subject: z.string(),
        htmlBody: z.string(),
        textBody: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const subjectVars = extractVariables(input.subject);
      const htmlVars = extractVariables(input.htmlBody);
      const textVars = input.textBody ? extractVariables(input.textBody) : [];

      // Combine and deduplicate
      const allVariables = [...new Set([...subjectVars, ...htmlVars, ...textVars])];

      return {
        variables: allVariables,
        bySection: {
          subject: subjectVars,
          htmlBody: htmlVars,
          textBody: textVars,
        },
      };
    }),

  // ===========================================================================
  // Update Status
  // ===========================================================================

  updateStatus: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: templateStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyTemplateOwnership(input.id, ctx.organizationId);

      const [updated] = await db
        .update(emailTemplates)
        .set({
          status: input.status,
          updatedBy: ctx.user?.id,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Get Active Templates (for workflow/selection dropdowns)
  // ===========================================================================

  listActive: authenticatedProcedure
    .input(
      z.object({
        category: templateCategoryEnum.optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(emailTemplates.organizationId, ctx.organizationId),
        eq(emailTemplates.status, 'active'),
      ];

      if (input?.category) {
        conditions.push(eq(emailTemplates.category, input.category));
      }

      return db.query.emailTemplates.findMany({
        where: and(...conditions),
        orderBy: [asc(emailTemplates.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          subject: true,
          category: true,
          description: true,
        },
      });
    }),
});

// =============================================================================
// Type Exports
// =============================================================================

export type EmailTemplatesRouter = typeof emailTemplatesRouter;
