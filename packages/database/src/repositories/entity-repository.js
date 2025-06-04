"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityRepository = void 0;
const base_repository_1 = require("./base-repository");
const entities_1 = require("../db/schema/entities");
const addresses_1 = require("../db/schema/addresses");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
// Validation schemas
const EntityTypeSchema = zod_1.z.enum(['Customer', 'Vendor', 'Employee', 'Partner', 'Lead', 'Prospect', 'Contact']);
const AddressSchema = zod_1.z.object({
    addressee: zod_1.z.string().optional().nullable(),
    companyName: zod_1.z.string().optional().nullable(),
    attention: zod_1.z.string().optional().nullable(),
    phoneNumber: zod_1.z.string().optional().nullable(),
    line1: zod_1.z.string().optional().nullable(),
    line2: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    stateProvince: zod_1.z.string().optional().nullable(),
    postalCode: zod_1.z.string().optional().nullable(),
    countryCode: zod_1.z.string().length(2).optional().nullable(),
});
const NewEntitySchema = zod_1.z.object({
    organizationId: zod_1.z.string(),
    name: zod_1.z.string(),
    displayName: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
    entityTypes: zod_1.z.array(EntityTypeSchema),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    website: zod_1.z.string().url().optional().nullable(),
    address: AddressSchema.optional().nullable(),
    parentEntityId: zod_1.z.string().uuid().optional().nullable(),
    primaryContactId: zod_1.z.string().uuid().optional().nullable(),
    taxId: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    customFields: zod_1.z.record(zod_1.z.any()).optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.any()).optional().nullable(),
    status: zod_1.z.enum(['active', 'inactive', 'archived']).default('active'),
    isActive: zod_1.z.boolean().default(true),
});
class EntityRepository extends base_repository_1.BaseRepository {
    async findById(id, organizationId) {
        const result = await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            name: entities_1.entities.name,
            displayName: entities_1.entities.displayName,
            code: entities_1.entities.code,
            entityTypes: entities_1.entities.entityTypes,
            email: entities_1.entities.email,
            phone: entities_1.entities.phone,
            website: entities_1.entities.website,
            addressId: entities_1.entities.addressId,
            parentEntityId: entities_1.entities.parentEntityId,
            primaryContactId: entities_1.entities.primaryContactId,
            taxId: entities_1.entities.taxId,
            description: entities_1.entities.description,
            notes: entities_1.entities.notes,
            customFields: entities_1.entities.customFields,
            metadata: entities_1.entities.metadata,
            status: entities_1.entities.status,
            isActive: entities_1.entities.isActive,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            address: (0, drizzle_orm_1.sql) `
          CASE WHEN ${addresses_1.addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses_1.addresses.id},
              'addressee', ${addresses_1.addresses.addressee},
              'companyName', ${addresses_1.addresses.companyName},
              'attention', ${addresses_1.addresses.attention},
              'phoneNumber', ${addresses_1.addresses.phoneNumber},
              'line1', ${addresses_1.addresses.line1},
              'line2', ${addresses_1.addresses.line2},
              'city', ${addresses_1.addresses.city},
              'stateProvince', ${addresses_1.addresses.stateProvince},
              'postalCode', ${addresses_1.addresses.postalCode},
              'countryCode', ${addresses_1.addresses.countryCode}
            )
          ELSE NULL END
        `,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId)))
            .limit(1);
        return result[0];
    }
    async findByCode(code, organizationId) {
        const result = await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            name: entities_1.entities.name,
            displayName: entities_1.entities.displayName,
            code: entities_1.entities.code,
            entityTypes: entities_1.entities.entityTypes,
            email: entities_1.entities.email,
            phone: entities_1.entities.phone,
            website: entities_1.entities.website,
            addressId: entities_1.entities.addressId,
            parentEntityId: entities_1.entities.parentEntityId,
            primaryContactId: entities_1.entities.primaryContactId,
            taxId: entities_1.entities.taxId,
            description: entities_1.entities.description,
            notes: entities_1.entities.notes,
            customFields: entities_1.entities.customFields,
            metadata: entities_1.entities.metadata,
            status: entities_1.entities.status,
            isActive: entities_1.entities.isActive,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            address: (0, drizzle_orm_1.sql) `
          CASE WHEN ${addresses_1.addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses_1.addresses.id},
              'addressee', ${addresses_1.addresses.addressee},
              'companyName', ${addresses_1.addresses.companyName},
              'attention', ${addresses_1.addresses.attention},
              'phoneNumber', ${addresses_1.addresses.phoneNumber},
              'line1', ${addresses_1.addresses.line1},
              'line2', ${addresses_1.addresses.line2},
              'city', ${addresses_1.addresses.city},
              'stateProvince', ${addresses_1.addresses.stateProvince},
              'postalCode', ${addresses_1.addresses.postalCode},
              'countryCode', ${addresses_1.addresses.countryCode}
            )
          ELSE NULL END
        `,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.code, code), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId)))
            .limit(1);
        return result[0];
    }
    async findByEmail(email, organizationId) {
        const result = await this.db
            .select()
            .from(entities_1.entities)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.email, email), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId)))
            .limit(1);
        return result[0];
    }
    async findByTypes(types, organizationId, options) {
        let query = this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            name: entities_1.entities.name,
            displayName: entities_1.entities.displayName,
            code: entities_1.entities.code,
            entityTypes: entities_1.entities.entityTypes,
            email: entities_1.entities.email,
            phone: entities_1.entities.phone,
            website: entities_1.entities.website,
            addressId: entities_1.entities.addressId,
            parentEntityId: entities_1.entities.parentEntityId,
            primaryContactId: entities_1.entities.primaryContactId,
            taxId: entities_1.entities.taxId,
            description: entities_1.entities.description,
            notes: entities_1.entities.notes,
            customFields: entities_1.entities.customFields,
            metadata: entities_1.entities.metadata,
            status: entities_1.entities.status,
            isActive: entities_1.entities.isActive,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            address: (0, drizzle_orm_1.sql) `
          CASE WHEN ${addresses_1.addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses_1.addresses.id},
              'addressee', ${addresses_1.addresses.addressee},
              'companyName', ${addresses_1.addresses.companyName},
              'attention', ${addresses_1.addresses.attention},
              'phoneNumber', ${addresses_1.addresses.phoneNumber},
              'line1', ${addresses_1.addresses.line1},
              'line2', ${addresses_1.addresses.line2},
              'city', ${addresses_1.addresses.city},
              'stateProvince', ${addresses_1.addresses.stateProvince},
              'postalCode', ${addresses_1.addresses.postalCode},
              'countryCode', ${addresses_1.addresses.countryCode}
            )
          ELSE NULL END
        `,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), 
        // Check if any of the requested types are in the entity's types array
        (0, drizzle_orm_1.or)(...types.map(type => (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, [type])))));
        // Apply additional filters
        const conditions = [];
        if (options?.parentEntityId !== undefined) {
            conditions.push(options.parentEntityId === null
                ? (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, null)
                : (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, options.parentEntityId));
        }
        if (options?.status) {
            conditions.push((0, drizzle_orm_1.eq)(entities_1.entities.status, options.status));
        }
        if (options?.isActive !== undefined) {
            conditions.push((0, drizzle_orm_1.eq)(entities_1.entities.isActive, options.isActive));
        }
        if (options?.searchTerm) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(entities_1.entities.name, `%${options.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.displayName, `%${options.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.email, `%${options.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.code, `%${options.searchTerm}%`)));
        }
        if (conditions.length > 0) {
            query = query.where((0, drizzle_orm_1.and)(...conditions));
        }
        // Apply ordering
        const orderColumn = options?.orderBy === 'createdAt' ? entities_1.entities.createdAt
            : options?.orderBy === 'updatedAt' ? entities_1.entities.updatedAt
                : entities_1.entities.name;
        query = query.orderBy(options?.orderDirection === 'desc' ? (0, drizzle_orm_1.desc)(orderColumn) : (0, drizzle_orm_1.asc)(orderColumn));
        // Apply pagination
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.offset(options.offset);
        }
        return await query;
    }
    async findContactsForEntity(entityId, organizationId) {
        return await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            name: entities_1.entities.name,
            displayName: entities_1.entities.displayName,
            code: entities_1.entities.code,
            entityTypes: entities_1.entities.entityTypes,
            email: entities_1.entities.email,
            phone: entities_1.entities.phone,
            website: entities_1.entities.website,
            addressId: entities_1.entities.addressId,
            parentEntityId: entities_1.entities.parentEntityId,
            primaryContactId: entities_1.entities.primaryContactId,
            taxId: entities_1.entities.taxId,
            description: entities_1.entities.description,
            notes: entities_1.entities.notes,
            customFields: entities_1.entities.customFields,
            metadata: entities_1.entities.metadata,
            status: entities_1.entities.status,
            isActive: entities_1.entities.isActive,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            address: (0, drizzle_orm_1.sql) `
          CASE WHEN ${addresses_1.addresses.id} IS NOT NULL THEN
            jsonb_build_object(
              'id', ${addresses_1.addresses.id},
              'addressee', ${addresses_1.addresses.addressee},
              'companyName', ${addresses_1.addresses.companyName},
              'attention', ${addresses_1.addresses.attention},
              'phoneNumber', ${addresses_1.addresses.phoneNumber},
              'line1', ${addresses_1.addresses.line1},
              'line2', ${addresses_1.addresses.line2},
              'city', ${addresses_1.addresses.city},
              'stateProvince', ${addresses_1.addresses.stateProvince},
              'postalCode', ${addresses_1.addresses.postalCode},
              'countryCode', ${addresses_1.addresses.countryCode}
            )
          ELSE NULL END
        `,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, entityId), (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Contact'])))
            .orderBy((0, drizzle_orm_1.asc)(entities_1.entities.name));
    }
    async create(data) {
        const validatedData = NewEntitySchema.parse(data);
        // Extract address data if provided
        const { address, ...entityData } = validatedData;
        // Create address if provided
        let addressId = null;
        if (address && (address.line1 || address.city)) {
            const [addressResult] = await this.db
                .insert(addresses_1.addresses)
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
            .insert(entities_1.entities)
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
    async update(id, organizationId, data) {
        // Get existing entity first
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Entity not found');
        }
        // Extract address from data if provided
        const { address, ...entityData } = data;
        // Handle address update if provided
        if (address !== undefined) {
            if (address && (address.line1 || address.city)) {
                if (existing.addressId) {
                    // Update existing address
                    await this.db
                        .update(addresses_1.addresses)
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
                        .where((0, drizzle_orm_1.eq)(addresses_1.addresses.id, existing.addressId));
                }
                else {
                    // Create new address
                    const [addressResult] = await this.db
                        .insert(addresses_1.addresses)
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
                    entityData.addressId = addressResult.id;
                }
            }
            else if (existing.addressId) {
                // Delete existing address if empty address provided
                await this.db
                    .delete(addresses_1.addresses)
                    .where((0, drizzle_orm_1.eq)(addresses_1.addresses.id, existing.addressId));
                entityData.addressId = null;
            }
        }
        // Ensure parent entity belongs to same organization if provided
        if (entityData.parentEntityId) {
            const parentExists = await this.belongsToOrganization(entities_1.entities, entityData.parentEntityId, organizationId);
            if (!parentExists) {
                throw new Error('Parent entity not found or does not belong to organization');
            }
        }
        // Ensure primary contact belongs to same organization if provided
        if (entityData.primaryContactId) {
            const contactExists = await this.belongsToOrganization(entities_1.entities, entityData.primaryContactId, organizationId);
            if (!contactExists) {
                throw new Error('Primary contact not found or does not belong to organization');
            }
        }
        const [result] = await this.db
            .update(entities_1.entities)
            .set({
            ...entityData,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId)))
            .returning();
        // Return updated entity with address
        return await this.findById(id, organizationId);
    }
    async delete(id, organizationId) {
        // Get entity to check for address
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            throw new Error('Entity not found');
        }
        // Check if entity has child entities
        const childCount = await this.db
            .select({ count: entities_1.entities.id })
            .from(entities_1.entities)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, id)));
        if (childCount.length > 0) {
            throw new Error('Cannot delete entity with child entities');
        }
        const result = await this.db
            .delete(entities_1.entities)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId)))
            .returning();
        // Delete associated address if exists
        if (existing.addressId) {
            await this.db
                .delete(addresses_1.addresses)
                .where((0, drizzle_orm_1.eq)(addresses_1.addresses.id, existing.addressId));
        }
        return result[0];
    }
    async addEntityType(id, organizationId, type) {
        const entity = await this.findById(id, organizationId);
        if (!entity) {
            throw new Error('Entity not found');
        }
        // Check if type already exists
        if (entity.entityTypes.includes(type)) {
            return entity;
        }
        const updatedTypes = [...entity.entityTypes, type];
        return await this.update(id, organizationId, {
            entityTypes: updatedTypes,
        });
    }
    async removeEntityType(id, organizationId, type) {
        const entity = await this.findById(id, organizationId);
        if (!entity) {
            throw new Error('Entity not found');
        }
        const updatedTypes = entity.entityTypes.filter(t => t !== type);
        // Ensure at least one type remains
        if (updatedTypes.length === 0) {
            throw new Error('Entity must have at least one type');
        }
        return await this.update(id, organizationId, {
            entityTypes: updatedTypes,
        });
    }
    // Count methods for pagination
    async countByTypes(types, organizationId, filters) {
        const conditions = [
            (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId),
            (0, drizzle_orm_1.or)(...types.map(type => (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, [type])))
        ];
        if (filters?.parentEntityId !== undefined) {
            conditions.push(filters.parentEntityId === null
                ? (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, null)
                : (0, drizzle_orm_1.eq)(entities_1.entities.parentEntityId, filters.parentEntityId));
        }
        if (filters?.status) {
            conditions.push((0, drizzle_orm_1.eq)(entities_1.entities.status, filters.status));
        }
        if (filters?.isActive !== undefined) {
            conditions.push((0, drizzle_orm_1.eq)(entities_1.entities.isActive, filters.isActive));
        }
        if (filters?.searchTerm) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(entities_1.entities.name, `%${filters.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.displayName, `%${filters.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.email, `%${filters.searchTerm}%`), (0, drizzle_orm_1.ilike)(entities_1.entities.code, `%${filters.searchTerm}%`)));
        }
        const result = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(entities_1.entities)
            .where((0, drizzle_orm_1.and)(...conditions));
        return result[0]?.count || 0;
    }
}
exports.EntityRepository = EntityRepository;
//# sourceMappingURL=entity-repository.js.map