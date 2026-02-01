import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  entityContacts,
  entities,
  CONTACT_ROLES,
} from '@glapi/database';
import {
  eq,
  and,
  desc,
} from 'drizzle-orm';

/**
 * Entity Contacts Router
 * Handles many-to-many relationships between entities (companies/leads/customers) and contacts
 */
export const entityContactsRouter = router({
  /**
   * List contacts for an entity (company/lead/customer)
   */
  listContacts: authenticatedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Get contact associations with contact details
      const associations = await db
        .select({
          id: entityContacts.id,
          entityId: entityContacts.entityId,
          contactId: entityContacts.contactId,
          role: entityContacts.role,
          isPrimary: entityContacts.isPrimary,
          notes: entityContacts.notes,
          createdAt: entityContacts.createdAt,
          updatedAt: entityContacts.updatedAt,
          // Contact details
          contactName: entities.name,
          contactDisplayName: entities.displayName,
          contactEmail: entities.email,
          contactPhone: entities.phone,
          contactStatus: entities.status,
        })
        .from(entityContacts)
        .innerJoin(entities, eq(entityContacts.contactId, entities.id))
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.organizationId, serviceContext.organizationId)
          )
        )
        .orderBy(desc(entityContacts.isPrimary), desc(entityContacts.createdAt));

      return associations.map((a: typeof associations[number]) => ({
        id: a.id,
        entityId: a.entityId,
        contactId: a.contactId,
        role: a.role,
        isPrimary: a.isPrimary,
        notes: a.notes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        contact: {
          id: a.contactId,
          name: a.contactName,
          displayName: a.contactDisplayName,
          email: a.contactEmail,
          phone: a.contactPhone,
          status: a.contactStatus,
        },
      }));
    }),

  /**
   * List entities a contact is associated with (reverse lookup)
   */
  listEntitiesForContact: authenticatedProcedure
    .input(z.object({ contactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Get entity associations with entity details
      const associations = await db
        .select({
          id: entityContacts.id,
          entityId: entityContacts.entityId,
          contactId: entityContacts.contactId,
          role: entityContacts.role,
          isPrimary: entityContacts.isPrimary,
          notes: entityContacts.notes,
          createdAt: entityContacts.createdAt,
          updatedAt: entityContacts.updatedAt,
          // Entity details
          entityName: entities.name,
          entityDisplayName: entities.displayName,
          entityEmail: entities.email,
          entityPhone: entities.phone,
          entityTypes: entities.entityTypes,
          entityStatus: entities.status,
        })
        .from(entityContacts)
        .innerJoin(entities, eq(entityContacts.entityId, entities.id))
        .where(
          and(
            eq(entityContacts.contactId, input.contactId),
            eq(entityContacts.organizationId, serviceContext.organizationId)
          )
        )
        .orderBy(desc(entityContacts.createdAt));

      return associations.map((a: typeof associations[number]) => ({
        id: a.id,
        entityId: a.entityId,
        contactId: a.contactId,
        role: a.role,
        isPrimary: a.isPrimary,
        notes: a.notes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        entity: {
          id: a.entityId,
          name: a.entityName,
          displayName: a.entityDisplayName,
          email: a.entityEmail,
          phone: a.entityPhone,
          entityTypes: a.entityTypes,
          status: a.entityStatus,
        },
      }));
    }),

  /**
   * Associate a contact with an entity
   */
  addContact: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      contactId: z.string().uuid(),
      role: z.string().optional(),
      isPrimary: z.boolean().optional().default(false),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Verify entity exists and belongs to org
      const entity = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.id, input.entityId),
            eq(entities.organizationId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!entity[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entity not found',
        });
      }

      // Verify contact exists and belongs to org
      const contact = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.id, input.contactId),
            eq(entities.organizationId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!contact[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      // Check if contact is already associated
      const existing = await db
        .select()
        .from(entityContacts)
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.contactId, input.contactId)
          )
        )
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Contact is already associated with this entity',
        });
      }

      // If setting as primary, unset any existing primary
      if (input.isPrimary) {
        await db
          .update(entityContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(entityContacts.entityId, input.entityId),
              eq(entityContacts.isPrimary, true)
            )
          );
      }

      // Create association
      const [association] = await db
        .insert(entityContacts)
        .values({
          organizationId: serviceContext.organizationId,
          entityId: input.entityId,
          contactId: input.contactId,
          role: input.role,
          isPrimary: input.isPrimary || false,
          notes: input.notes,
        })
        .returning();

      return association;
    }),

  /**
   * Update contact association (role, isPrimary, notes)
   */
  updateContact: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      contactId: z.string().uuid(),
      role: z.string().optional(),
      isPrimary: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Find existing association
      const existing = await db
        .select()
        .from(entityContacts)
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.contactId, input.contactId),
            eq(entityContacts.organizationId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact association not found',
        });
      }

      // If setting as primary, unset any existing primary
      if (input.isPrimary === true && !existing[0].isPrimary) {
        await db
          .update(entityContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(entityContacts.entityId, input.entityId),
              eq(entityContacts.isPrimary, true)
            )
          );
      }

      // Update association
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.role !== undefined) updateData.role = input.role;
      if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await db
        .update(entityContacts)
        .set(updateData)
        .where(eq(entityContacts.id, existing[0].id))
        .returning();

      return updated;
    }),

  /**
   * Remove contact association
   */
  removeContact: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      contactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Find existing association
      const existing = await db
        .select()
        .from(entityContacts)
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.contactId, input.contactId),
            eq(entityContacts.organizationId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact association not found',
        });
      }

      // Delete association
      await db
        .delete(entityContacts)
        .where(eq(entityContacts.id, existing[0].id));

      return { success: true };
    }),

  /**
   * Get available contact roles
   */
  getRoles: authenticatedProcedure
    .query(() => {
      return Object.values(CONTACT_ROLES);
    }),

  /**
   * Set primary contact for an entity
   */
  setPrimaryContact: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      contactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, serviceContext } = ctx;

      if (!serviceContext?.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Organization context required',
        });
      }

      // Find existing association
      const existing = await db
        .select()
        .from(entityContacts)
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.contactId, input.contactId),
            eq(entityContacts.organizationId, serviceContext.organizationId)
          )
        )
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact association not found',
        });
      }

      // Unset any existing primary
      await db
        .update(entityContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(entityContacts.entityId, input.entityId),
            eq(entityContacts.isPrimary, true)
          )
        );

      // Set new primary
      const [updated] = await db
        .update(entityContacts)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(entityContacts.id, existing[0].id))
        .returning();

      return updated;
    }),
});
