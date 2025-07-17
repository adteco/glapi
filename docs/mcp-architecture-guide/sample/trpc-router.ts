/**
 * Sample tRPC Router for Entity Management
 * This demonstrates the backend API structure that MCP tools interact with
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Input validation schemas
const createEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().optional(),
  code: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

const updateEntitySchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).optional(),
    displayName: z.string().optional(),
    code: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// Example entity router
export const entitiesRouter = router({
  /**
   * List all entities
   */
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      
      try {
        // Build query
        let query = db
          .selectFrom('entities')
          .selectAll()
          .where('organizationId', '=', organizationId);
        
        // Apply filters
        if (!input?.includeInactive) {
          query = query.where('isActive', '=', true);
        }
        
        if (input?.search) {
          query = query.where((eb) =>
            eb.or([
              eb('name', 'ilike', `%${input.search}%`),
              eb('displayName', 'ilike', `%${input.search}%`),
              eb('email', 'ilike', `%${input.search}%`),
            ])
          );
        }
        
        // Apply pagination
        if (input?.limit) {
          query = query.limit(input.limit);
        }
        if (input?.offset) {
          query = query.offset(input.offset);
        }
        
        // Execute query
        const entities = await query.execute();
        
        return {
          data: entities,
          total: entities.length,
        };
      } catch (error) {
        console.error('Error listing entities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list entities',
        });
      }
    }),

  /**
   * Get a single entity by ID
   */
  get: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      
      try {
        const entity = await db
          .selectFrom('entities')
          .selectAll()
          .where('id', '=', input.id)
          .where('organizationId', '=', organizationId)
          .executeTakeFirst();
        
        if (!entity) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Entity not found',
          });
        }
        
        return entity;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error getting entity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get entity',
        });
      }
    }),

  /**
   * Create a new entity
   */
  create: protectedProcedure
    .input(createEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, userId } = ctx;
      
      try {
        // Generate a unique code if not provided
        const code = input.code || `ENT-${Date.now()}`;
        
        const entity = await db
          .insertInto('entities')
          .values({
            organizationId,
            name: input.name,
            displayName: input.displayName || input.name,
            code,
            email: input.email,
            phone: input.phone,
            website: input.website,
            status: 'active',
            isActive: input.isActive,
            metadata: input.metadata || {},
            createdBy: userId,
            updatedBy: userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        
        return entity;
      } catch (error) {
        console.error('Error creating entity:', error);
        
        // Check for unique constraint violations
        if (error instanceof Error && error.message.includes('unique')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An entity with this code already exists',
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create entity',
        });
      }
    }),

  /**
   * Update an entity
   */
  update: protectedProcedure
    .input(updateEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, userId } = ctx;
      
      try {
        // First check if entity exists and belongs to organization
        const existing = await db
          .selectFrom('entities')
          .select(['id'])
          .where('id', '=', input.id)
          .where('organizationId', '=', organizationId)
          .executeTakeFirst();
        
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Entity not found',
          });
        }
        
        // Build update data
        const updateData: any = {
          updatedBy: userId,
          updatedAt: new Date(),
        };
        
        if (input.data.name !== undefined) updateData.name = input.data.name;
        if (input.data.displayName !== undefined) updateData.displayName = input.data.displayName;
        if (input.data.code !== undefined) updateData.code = input.data.code;
        if (input.data.email !== undefined) updateData.email = input.data.email;
        if (input.data.phone !== undefined) updateData.phone = input.data.phone;
        if (input.data.website !== undefined) updateData.website = input.data.website;
        if (input.data.status !== undefined) updateData.status = input.data.status;
        if (input.data.isActive !== undefined) updateData.isActive = input.data.isActive;
        if (input.data.metadata !== undefined) {
          // Merge metadata
          const currentEntity = await db
            .selectFrom('entities')
            .select(['metadata'])
            .where('id', '=', input.id)
            .executeTakeFirstOrThrow();
          
          updateData.metadata = {
            ...(currentEntity.metadata || {}),
            ...input.data.metadata,
          };
        }
        
        const entity = await db
          .updateTable('entities')
          .set(updateData)
          .where('id', '=', input.id)
          .where('organizationId', '=', organizationId)
          .returningAll()
          .executeTakeFirstOrThrow();
        
        return entity;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error updating entity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update entity',
        });
      }
    }),

  /**
   * Delete an entity
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      
      try {
        // Check if entity exists
        const existing = await db
          .selectFrom('entities')
          .select(['id', 'name'])
          .where('id', '=', input.id)
          .where('organizationId', '=', organizationId)
          .executeTakeFirst();
        
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Entity not found',
          });
        }
        
        // Soft delete by setting isActive to false
        await db
          .updateTable('entities')
          .set({
            isActive: false,
            status: 'archived',
            updatedAt: new Date(),
          })
          .where('id', '=', input.id)
          .where('organizationId', '=', organizationId)
          .execute();
        
        return { success: true, deletedEntity: existing.name };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error deleting entity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete entity',
        });
      }
    }),

  /**
   * Bulk operations example
   */
  bulkCreate: protectedProcedure
    .input(z.object({
      entities: z.array(createEntitySchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId, userId } = ctx;
      
      try {
        const entities = await db.transaction().execute(async (trx) => {
          const results = [];
          
          for (const entityData of input.entities) {
            const code = entityData.code || `ENT-${Date.now()}-${Math.random()}`;
            
            const entity = await trx
              .insertInto('entities')
              .values({
                organizationId,
                name: entityData.name,
                displayName: entityData.displayName || entityData.name,
                code,
                email: entityData.email,
                phone: entityData.phone,
                website: entityData.website,
                status: 'active',
                isActive: entityData.isActive,
                metadata: entityData.metadata || {},
                createdBy: userId,
                updatedBy: userId,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            
            results.push(entity);
          }
          
          return results;
        });
        
        return {
          created: entities.length,
          entities,
        };
      } catch (error) {
        console.error('Error bulk creating entities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk create entities',
        });
      }
    }),

  /**
   * Search with advanced filters
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      filters: z.object({
        status: z.array(z.enum(['active', 'inactive', 'archived'])).optional(),
        hasEmail: z.boolean().optional(),
        hasPhone: z.boolean().optional(),
        createdAfter: z.date().optional(),
        createdBefore: z.date().optional(),
      }).optional(),
      sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      
      try {
        let query = db
          .selectFrom('entities')
          .selectAll()
          .where('organizationId', '=', organizationId)
          .where((eb) =>
            eb.or([
              eb('name', 'ilike', `%${input.query}%`),
              eb('displayName', 'ilike', `%${input.query}%`),
              eb('email', 'ilike', `%${input.query}%`),
              eb('code', 'ilike', `%${input.query}%`),
            ])
          );
        
        // Apply filters
        if (input.filters?.status && input.filters.status.length > 0) {
          query = query.where('status', 'in', input.filters.status);
        }
        
        if (input.filters?.hasEmail === true) {
          query = query.where('email', 'is not', null);
        } else if (input.filters?.hasEmail === false) {
          query = query.where('email', 'is', null);
        }
        
        if (input.filters?.hasPhone === true) {
          query = query.where('phone', 'is not', null);
        } else if (input.filters?.hasPhone === false) {
          query = query.where('phone', 'is', null);
        }
        
        if (input.filters?.createdAfter) {
          query = query.where('createdAt', '>=', input.filters.createdAfter);
        }
        
        if (input.filters?.createdBefore) {
          query = query.where('createdAt', '<=', input.filters.createdBefore);
        }
        
        // Apply sorting
        const sortBy = input.sortBy || 'name';
        const sortOrder = input.sortOrder || 'asc';
        query = query.orderBy(sortBy, sortOrder);
        
        const results = await query.execute();
        
        return {
          results,
          count: results.length,
        };
      } catch (error) {
        console.error('Error searching entities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search entities',
        });
      }
    }),
});

// Export type for use in other files
export type EntitiesRouter = typeof entitiesRouter;