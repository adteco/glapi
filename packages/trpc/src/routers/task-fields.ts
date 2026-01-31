/**
 * tRPC Router for Task Field Definitions
 *
 * Provides API endpoints for managing custom task field definitions:
 * - CRUD operations for field definitions
 * - Field reordering
 * - Entity-type-specific field queries
 */

import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  db,
  taskFieldDefinitions,
  TASK_FIELD_TYPE,
  eq,
  and,
  or,
  asc,
  isNull,
} from '@glapi/database';
import type {
  TaskFieldDefinition,
  FieldOptions,
} from '@glapi/database';

// =============================================================================
// Input Schemas
// =============================================================================

const fieldTypeEnum = z.enum([
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'user',
  'url',
  'email',
  'phone',
]);

// Select option schema for select/multiselect fields
const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().optional(),
});

// Field options schema - varies by field type
const fieldOptionsSchema = z.object({
  // For select/multiselect
  options: z.array(selectOptionSchema).optional(),
  // For number/currency
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().int().min(0).max(10).optional(),
  currencyCode: z.string().length(3).optional(),
  // For text/textarea
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  pattern: z.string().optional(),
}).passthrough();

// Create field definition schema
const createFieldSchema = z.object({
  fieldKey: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Field key must start with lowercase letter and contain only lowercase letters, numbers, and underscores'),
  fieldLabel: z.string().min(1).max(255),
  fieldType: fieldTypeEnum,
  fieldOptions: fieldOptionsSchema.optional(),
  entityType: z.string().max(50).optional().nullable(),
  isRequired: z.boolean().optional().default(false),
  defaultValue: z.any().optional().nullable(),
  placeholder: z.string().max(255).optional().nullable(),
  helpText: z.string().optional().nullable(),
  displayOrder: z.number().int().min(0).optional().default(0),
});

// Update field definition schema - cannot change fieldKey or fieldType
const updateFieldSchema = z.object({
  fieldLabel: z.string().min(1).max(255).optional(),
  fieldOptions: fieldOptionsSchema.optional().nullable(),
  isRequired: z.boolean().optional(),
  defaultValue: z.any().optional().nullable(),
  placeholder: z.string().max(255).optional().nullable(),
  helpText: z.string().optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Reorder schema
const reorderFieldsSchema = z.object({
  fields: z.array(
    z.object({
      id: z.string().uuid(),
      displayOrder: z.number().int().min(0),
    })
  ),
});

// List query schema
const listFieldsSchema = z.object({
  entityType: z.string().max(50).optional(),
  includeInactive: z.boolean().optional().default(false),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Verify a field definition belongs to the current organization
 */
async function verifyFieldOwnership(
  fieldId: string,
  organizationId: string
): Promise<TaskFieldDefinition> {
  const field = await db.query.taskFieldDefinitions.findFirst({
    where: and(
      eq(taskFieldDefinitions.id, fieldId),
      eq(taskFieldDefinitions.organizationId, organizationId)
    ),
  });

  if (!field) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Task field definition not found',
    });
  }

  return field;
}

/**
 * Check if a field key already exists for the given org and entity type
 */
async function checkFieldKeyUniqueness(
  organizationId: string,
  fieldKey: string,
  entityType: string | null | undefined,
  excludeId?: string
): Promise<void> {
  // Build conditions based on whether entityType is null or has a value
  let conditions;
  if (entityType === null || entityType === undefined) {
    conditions = and(
      eq(taskFieldDefinitions.organizationId, organizationId),
      eq(taskFieldDefinitions.fieldKey, fieldKey),
      isNull(taskFieldDefinitions.entityType)
    );
  } else {
    conditions = and(
      eq(taskFieldDefinitions.organizationId, organizationId),
      eq(taskFieldDefinitions.fieldKey, fieldKey),
      eq(taskFieldDefinitions.entityType, entityType)
    );
  }

  const existing = await db.query.taskFieldDefinitions.findFirst({
    where: conditions,
  });

  if (existing && (!excludeId || existing.id !== excludeId)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `A field with key "${fieldKey}" already exists for this entity type`,
    });
  }
}

// =============================================================================
// Router
// =============================================================================

export const taskFieldsRouter = router({
  // ===========================================================================
  // List field definitions
  // ===========================================================================

  /**
   * List field definitions for the organization
   * If entityType is provided, returns global fields + entity-specific fields
   * Sorted by displayOrder
   */
  list: authenticatedProcedure
    .input(listFieldsSchema.optional())
    .query(async ({ ctx, input }) => {
      const { entityType, includeInactive } = input ?? {};

      // Build base conditions
      const baseConditions = [eq(taskFieldDefinitions.organizationId, ctx.organizationId)];

      if (!includeInactive) {
        baseConditions.push(eq(taskFieldDefinitions.isActive, true));
      }

      // If entityType is specified, get global fields + entity-specific fields
      if (entityType) {
        baseConditions.push(
          or(
            isNull(taskFieldDefinitions.entityType),
            eq(taskFieldDefinitions.entityType, entityType)
          )!
        );
      }

      const result = await db.query.taskFieldDefinitions.findMany({
        where: and(...baseConditions),
        orderBy: [asc(taskFieldDefinitions.displayOrder), asc(taskFieldDefinitions.fieldLabel)],
      });

      return result;
    }),

  // ===========================================================================
  // Get single field definition
  // ===========================================================================

  /**
   * Get a single field definition by ID
   */
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const field = await verifyFieldOwnership(input.id, ctx.organizationId);
      return field;
    }),

  // ===========================================================================
  // Create field definition
  // ===========================================================================

  /**
   * Create a new task field definition
   * Validates fieldKey uniqueness per org+entityType
   */
  create: authenticatedProcedure
    .input(createFieldSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate field key
      await checkFieldKeyUniqueness(
        ctx.organizationId,
        input.fieldKey,
        input.entityType
      );

      // Validate fieldOptions based on fieldType
      if (input.fieldType === 'select' || input.fieldType === 'multiselect') {
        if (!input.fieldOptions?.options || input.fieldOptions.options.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Select and multiselect fields require at least one option',
          });
        }
      }

      const [field] = await db
        .insert(taskFieldDefinitions)
        .values({
          organizationId: ctx.organizationId,
          fieldKey: input.fieldKey,
          fieldLabel: input.fieldLabel,
          fieldType: input.fieldType,
          fieldOptions: (input.fieldOptions as FieldOptions) ?? {},
          entityType: input.entityType ?? null,
          isRequired: input.isRequired,
          defaultValue: input.defaultValue ?? null,
          placeholder: input.placeholder ?? null,
          helpText: input.helpText ?? null,
          displayOrder: input.displayOrder,
          createdBy: ctx.user?.entityId ?? null,
        })
        .returning();

      return field;
    }),

  // ===========================================================================
  // Update field definition
  // ===========================================================================

  /**
   * Update a task field definition
   * Cannot change fieldKey or fieldType after creation (would break existing data)
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateFieldSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await verifyFieldOwnership(input.id, ctx.organizationId);

      // Build update data, filtering out undefined values
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.data.fieldLabel !== undefined) {
        updateData.fieldLabel = input.data.fieldLabel;
      }
      if (input.data.fieldOptions !== undefined) {
        // Validate fieldOptions if updating for select/multiselect
        if (
          (existing.fieldType === 'select' || existing.fieldType === 'multiselect') &&
          input.data.fieldOptions !== null
        ) {
          const options = (input.data.fieldOptions as { options?: unknown[] })?.options;
          if (!options || options.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Select and multiselect fields require at least one option',
            });
          }
        }
        updateData.fieldOptions = input.data.fieldOptions as FieldOptions ?? {};
      }
      if (input.data.isRequired !== undefined) {
        updateData.isRequired = input.data.isRequired;
      }
      if (input.data.defaultValue !== undefined) {
        updateData.defaultValue = input.data.defaultValue;
      }
      if (input.data.placeholder !== undefined) {
        updateData.placeholder = input.data.placeholder;
      }
      if (input.data.helpText !== undefined) {
        updateData.helpText = input.data.helpText;
      }
      if (input.data.displayOrder !== undefined) {
        updateData.displayOrder = input.data.displayOrder;
      }
      if (input.data.isActive !== undefined) {
        updateData.isActive = input.data.isActive;
      }

      const [updated] = await db
        .update(taskFieldDefinitions)
        .set(updateData)
        .where(eq(taskFieldDefinitions.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Delete (soft delete) field definition
  // ===========================================================================

  /**
   * Soft delete a field definition (set isActive = false)
   * Don't hard delete as tasks may reference this field
   */
  delete: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyFieldOwnership(input.id, ctx.organizationId);

      const [updated] = await db
        .update(taskFieldDefinitions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(taskFieldDefinitions.id, input.id))
        .returning();

      return updated;
    }),

  // ===========================================================================
  // Reorder fields
  // ===========================================================================

  /**
   * Reorder multiple field definitions at once
   */
  reorder: authenticatedProcedure
    .input(reorderFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify all fields belong to this organization
      const fieldIds = input.fields.map((f) => f.id);

      for (const fieldId of fieldIds) {
        await verifyFieldOwnership(fieldId, ctx.organizationId);
      }

      // Update each field's display order
      const updates = input.fields.map(async (item) => {
        return db
          .update(taskFieldDefinitions)
          .set({
            displayOrder: item.displayOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(taskFieldDefinitions.id, item.id),
              eq(taskFieldDefinitions.organizationId, ctx.organizationId)
            )
          );
      });

      await Promise.all(updates);

      // Return the updated fields
      const result = await db.query.taskFieldDefinitions.findMany({
        where: eq(taskFieldDefinitions.organizationId, ctx.organizationId),
        orderBy: [asc(taskFieldDefinitions.displayOrder), asc(taskFieldDefinitions.fieldLabel)],
      });

      return result;
    }),

  // ===========================================================================
  // Get fields for entity type
  // ===========================================================================

  /**
   * Get all applicable fields for an entity type
   * Returns merged list: global fields + entity-specific fields
   * Useful when rendering task form
   */
  getForEntity: authenticatedProcedure
    .input(z.object({ entityType: z.string().max(50) }))
    .query(async ({ ctx, input }) => {
      const result = await db.query.taskFieldDefinitions.findMany({
        where: and(
          eq(taskFieldDefinitions.organizationId, ctx.organizationId),
          eq(taskFieldDefinitions.isActive, true),
          or(
            isNull(taskFieldDefinitions.entityType),
            eq(taskFieldDefinitions.entityType, input.entityType)
          )
        ),
        orderBy: [asc(taskFieldDefinitions.displayOrder), asc(taskFieldDefinitions.fieldLabel)],
      });

      // Separate global and entity-specific fields for the response
      const globalFields = result.filter((f) => f.entityType === null);
      const entityFields = result.filter((f) => f.entityType === input.entityType);

      return {
        all: result,
        global: globalFields,
        entitySpecific: entityFields,
      };
    }),
});
