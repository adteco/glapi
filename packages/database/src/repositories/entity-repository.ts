import { BaseRepository } from './base-repository';
import { entities } from '../db/schema/entities';
import { addresses } from '../db/schema/addresses';
import { eq, and, or, ilike, arrayContains, desc, asc, sql, isNull } from 'drizzle-orm';
import { z } from 'zod';

// Validation schemas
const EntityTypeSchema = z.enum(['Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact']);
type EntityType = z.infer<typeof EntityTypeSchema>;

const AddressSchema = z.object({
  addressee: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  attention: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  line1: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  stateProvince: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  countryCode: z.string().length(2).optional().nullable(),
});

const NewEntitySchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  displayName: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  entityTypes: z.array(EntityTypeSchema),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address: AddressSchema.optional().nullable(),
  parentEntityId: z.string().uuid().optional().nullable(),
  primaryContactId: z.string().uuid().optional().nullable(),
  taxId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  isActive: z.boolean().default(true),
});

type NewEntity = z.infer<typeof NewEntitySchema>;

export class EntityRepository extends BaseRepository {
  async findById(id: string, organizationId: string) {
    const result = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        name: entities.name,
        displayName: entities.displayName,
        code: entities.code,
        entityTypes: entities.entityTypes,
        email: entities.email,
        phone: entities.phone,
        website: entities.website,
        addressId: entities.addressId,
        parentEntityId: entities.parentEntityId,
        primaryContactId: entities.primaryContactId,
        taxId: entities.taxId,
        description: entities.description,
        notes: entities.notes,
        customFields: entities.customFields,
        metadata: entities.metadata,
        status: entities.status,
        isActive: entities.isActive,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        address: sql`
          CASE WHEN ${addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses.id},
              'addressee', ${addresses.addressee},
              'companyName', ${addresses.companyName},
              'attention', ${addresses.attention},
              'phoneNumber', ${addresses.phoneNumber},
              'line1', ${addresses.line1},
              'line2', ${addresses.line2},
              'city', ${addresses.city},
              'stateProvince', ${addresses.stateProvince},
              'postalCode', ${addresses.postalCode},
              'countryCode', ${addresses.countryCode}
            )
          ELSE NULL END
        `,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async findByCode(code: string, organizationId: string) {
    const result = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        name: entities.name,
        displayName: entities.displayName,
        code: entities.code,
        entityTypes: entities.entityTypes,
        email: entities.email,
        phone: entities.phone,
        website: entities.website,
        addressId: entities.addressId,
        parentEntityId: entities.parentEntityId,
        primaryContactId: entities.primaryContactId,
        taxId: entities.taxId,
        description: entities.description,
        notes: entities.notes,
        customFields: entities.customFields,
        metadata: entities.metadata,
        status: entities.status,
        isActive: entities.isActive,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        address: sql`
          CASE WHEN ${addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses.id},
              'addressee', ${addresses.addressee},
              'companyName', ${addresses.companyName},
              'attention', ${addresses.attention},
              'phoneNumber', ${addresses.phoneNumber},
              'line1', ${addresses.line1},
              'line2', ${addresses.line2},
              'city', ${addresses.city},
              'stateProvince', ${addresses.stateProvince},
              'postalCode', ${addresses.postalCode},
              'countryCode', ${addresses.countryCode}
            )
          ELSE NULL END
        `,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.code, code),
          eq(entities.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async findByEmail(email: string, organizationId: string) {
    const result = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.email, email),
          eq(entities.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async findByTypes(
    types: EntityType[], 
    organizationId: string,
    options?: {
      parentEntityId?: string | null;
      status?: string;
      isActive?: boolean;
      searchTerm?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'name' | 'createdAt' | 'updatedAt';
      orderDirection?: 'asc' | 'desc';
    }
  ) {
    const baseConditions = [
      eq(entities.organizationId, organizationId),
      // Check if any of the requested types are in the entity's types array
      or(...types.map(type => arrayContains(entities.entityTypes, [type])))
    ];

    // Apply additional filters
    const additionalConditions = [];
    
    if (options?.parentEntityId !== undefined) {
      additionalConditions.push(
        options.parentEntityId === null 
          ? isNull(entities.parentEntityId)
          : eq(entities.parentEntityId, options.parentEntityId)
      );
    }

    if (options?.status) {
      additionalConditions.push(eq(entities.status, options.status));
    }

    if (options?.isActive !== undefined) {
      additionalConditions.push(eq(entities.isActive, options.isActive));
    }

    if (options?.searchTerm) {
      additionalConditions.push(
        or(
          ilike(entities.name, `%${options.searchTerm}%`),
          ilike(entities.displayName, `%${options.searchTerm}%`),
          ilike(entities.email, `%${options.searchTerm}%`),
          ilike(entities.code, `%${options.searchTerm}%`)
        )
      );
    }

    const allConditions = additionalConditions.length > 0 
      ? and(...baseConditions, ...additionalConditions) 
      : and(...baseConditions);

    // Apply ordering
    const orderColumn = options?.orderBy === 'createdAt' ? entities.createdAt 
                      : options?.orderBy === 'updatedAt' ? entities.updatedAt 
                      : entities.name;
    
    const baseQuery = this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        name: entities.name,
        displayName: entities.displayName,
        code: entities.code,
        entityTypes: entities.entityTypes,
        email: entities.email,
        phone: entities.phone,
        website: entities.website,
        addressId: entities.addressId,
        parentEntityId: entities.parentEntityId,
        primaryContactId: entities.primaryContactId,
        taxId: entities.taxId,
        description: entities.description,
        notes: entities.notes,
        customFields: entities.customFields,
        metadata: entities.metadata,
        status: entities.status,
        isActive: entities.isActive,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        address: sql`
          CASE WHEN ${addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses.id},
              'addressee', ${addresses.addressee},
              'companyName', ${addresses.companyName},
              'attention', ${addresses.attention},
              'phoneNumber', ${addresses.phoneNumber},
              'line1', ${addresses.line1},
              'line2', ${addresses.line2},
              'city', ${addresses.city},
              'stateProvince', ${addresses.stateProvince},
              'postalCode', ${addresses.postalCode},
              'countryCode', ${addresses.countryCode}
            )
          ELSE NULL END
        `,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(allConditions)
      .orderBy(
        options?.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn)
      );

    // Apply pagination by building a complete chain
    if (options?.limit && options?.offset) {
      return await baseQuery.limit(options.limit).offset(options.offset);
    } else if (options?.limit) {
      return await baseQuery.limit(options.limit);
    } else if (options?.offset) {
      return await baseQuery.offset(options.offset);
    }

    return await baseQuery;
  }

  async findContactsForEntity(entityId: string, organizationId: string) {
    return await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        name: entities.name,
        displayName: entities.displayName,
        code: entities.code,
        entityTypes: entities.entityTypes,
        email: entities.email,
        phone: entities.phone,
        website: entities.website,
        addressId: entities.addressId,
        parentEntityId: entities.parentEntityId,
        primaryContactId: entities.primaryContactId,
        taxId: entities.taxId,
        description: entities.description,
        notes: entities.notes,
        customFields: entities.customFields,
        metadata: entities.metadata,
        status: entities.status,
        isActive: entities.isActive,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        address: sql`
          CASE WHEN ${addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses.id},
              'addressee', ${addresses.addressee},
              'companyName', ${addresses.companyName},
              'attention', ${addresses.attention},
              'phoneNumber', ${addresses.phoneNumber},
              'line1', ${addresses.line1},
              'line2', ${addresses.line2},
              'city', ${addresses.city},
              'stateProvince', ${addresses.stateProvince},
              'postalCode', ${addresses.postalCode},
              'countryCode', ${addresses.countryCode}
            )
          ELSE NULL END
        `,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.organizationId, organizationId),
          eq(entities.parentEntityId, entityId),
          arrayContains(entities.entityTypes, ['Contact'])
        )
      )
      .orderBy(asc(entities.name));
  }

  async create(data: NewEntity) {
    const validatedData = NewEntitySchema.parse(data);
    
    // Extract address data if provided
    const { address, ...entityData } = validatedData;
    
    // Create address if provided
    let addressId = null;
    if (address && (address.line1 || address.city)) {
      const [addressResult] = await this.db
        .insert(addresses)
        .values({
          organizationId: validatedData.organizationId,
          addressee: address.addressee,
          companyName: address.companyName || validatedData.name,
          attention: address.attention,
          phoneNumber: address.phoneNumber || validatedData.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          stateProvince: address.stateProvince,
          postalCode: address.postalCode,
          countryCode: address.countryCode,
        })
        .returning();
      
      addressId = addressResult.id;
    }
    
    // Create entity with address reference
    const [result] = await this.db
      .insert(entities)
      .values({
        ...entityData,
        addressId,
      })
      .returning();
    
    // Return entity with address if created
    if (addressId) {
      return await this.findById(result.id, result.organizationId);
    }
    
    return result;
  }

  async update(id: string, organizationId: string, data: Partial<Omit<NewEntity, 'organizationId'>>) {
    // Get existing entity first
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new Error('Entity not found');
    }
    
    // Extract address from data if provided
    const { address, ...entityData } = data;
    
    // Create update data object with proper typing
    const updateData: any = { ...entityData };
    
    // Handle address update if provided
    if (address !== undefined) {
      if (address && (address.line1 || address.city)) {
        if (existing.addressId) {
          // Update existing address
          await this.db
            .update(addresses)
            .set({
              addressee: address.addressee,
              companyName: address.companyName || data.name || existing.name,
              attention: address.attention,
              phoneNumber: address.phoneNumber || data.phone || existing.phone,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              stateProvince: address.stateProvince,
              postalCode: address.postalCode,
              countryCode: address.countryCode,
              updatedAt: new Date(),
            })
            .where(eq(addresses.id, existing.addressId));
        } else {
          // Create new address
          const [addressResult] = await this.db
            .insert(addresses)
            .values({
              organizationId: organizationId,
              addressee: address.addressee,
              companyName: address.companyName || data.name || existing.name,
              attention: address.attention,
              phoneNumber: address.phoneNumber || data.phone || existing.phone,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              stateProvince: address.stateProvince,
              postalCode: address.postalCode,
              countryCode: address.countryCode,
            })
            .returning();
          
          updateData.addressId = addressResult.id;
        }
      } else if (existing.addressId) {
        // Delete existing address if empty address provided
        await this.db
          .delete(addresses)
          .where(eq(addresses.id, existing.addressId));
        updateData.addressId = null;
      }
    }
    
    // Ensure parent entity belongs to same organization if provided
    if (updateData.parentEntityId) {
      const parentExists = await this.belongsToOrganization(
        entities,
        updateData.parentEntityId,
        organizationId
      );
      
      if (!parentExists) {
        throw new Error('Parent entity not found or does not belong to organization');
      }
    }

    // Ensure primary contact belongs to same organization if provided
    if (updateData.primaryContactId) {
      const contactExists = await this.belongsToOrganization(
        entities,
        updateData.primaryContactId,
        organizationId
      );
      
      if (!contactExists) {
        throw new Error('Primary contact not found or does not belong to organization');
      }
    }

    await this.db
      .update(entities)
      .set({
        ...updateData,
      })
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId)
        )
      )
      .returning();
    
    // Return updated entity with address
    return await this.findById(id, organizationId);
  }

  async delete(id: string, organizationId: string) {
    // Get entity to check for address
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new Error('Entity not found');
    }
    
    // Check if entity has child entities
    const childCount = await this.db
      .select({ count: entities.id })
      .from(entities)
      .where(
        and(
          eq(entities.organizationId, organizationId),
          eq(entities.parentEntityId, id)
        )
      );

    if (childCount.length > 0) {
      throw new Error('Cannot delete entity with child entities');
    }

    const result = await this.db
      .delete(entities)
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId)
        )
      )
      .returning();
    
    // Delete associated address if exists
    if (existing.addressId) {
      await this.db
        .delete(addresses)
        .where(eq(addresses.id, existing.addressId));
    }
    
    return result[0];
  }

  async addEntityType(id: string, organizationId: string, type: EntityType) {
    const entity = await this.findById(id, organizationId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // Check if type already exists
    if (entity.entityTypes.includes(type)) {
      return entity;
    }

    const updatedTypes = [...entity.entityTypes, type] as EntityType[];
    
    return await this.update(id, organizationId, {
      entityTypes: updatedTypes,
    });
  }

  async removeEntityType(id: string, organizationId: string, type: EntityType) {
    const entity = await this.findById(id, organizationId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    const updatedTypes = entity.entityTypes.filter(t => t !== type) as EntityType[];
    
    // Ensure at least one type remains
    if (updatedTypes.length === 0) {
      throw new Error('Entity must have at least one type');
    }

    return await this.update(id, organizationId, {
      entityTypes: updatedTypes,
    });
  }

  // Count methods for pagination
  async countByTypes(types: EntityType[], organizationId: string, filters?: {
    parentEntityId?: string | null;
    status?: string;
    isActive?: boolean;
    searchTerm?: string;
  }) {
    const conditions: any[] = [
      eq(entities.organizationId, organizationId),
      or(...types.map(type => arrayContains(entities.entityTypes, [type])))
    ];

    if (filters?.parentEntityId !== undefined) {
      conditions.push(
        filters.parentEntityId === null 
          ? isNull(entities.parentEntityId)
          : eq(entities.parentEntityId, filters.parentEntityId)
      );
    }

    if (filters?.status) {
      conditions.push(eq(entities.status, filters.status));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(entities.isActive, filters.isActive));
    }

    if (filters?.searchTerm) {
      conditions.push(
        or(
          ilike(entities.name, `%${filters.searchTerm}%`),
          ilike(entities.displayName, `%${filters.searchTerm}%`),
          ilike(entities.email, `%${filters.searchTerm}%`),
          ilike(entities.code, `%${filters.searchTerm}%`)
        )
      );
    }

    const result = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(entities)
      .where(and(...conditions));
    
    return result[0]?.count || 0;
  }
}