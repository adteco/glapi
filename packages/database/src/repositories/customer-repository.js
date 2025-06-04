"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const base_repository_1 = require("./base-repository");
const entities_1 = require("../db/schema/entities");
const addresses_1 = require("../db/schema/addresses");
class CustomerRepository extends base_repository_1.BaseRepository {
    /**
     * Find a customer by ID with organization context
     */
    async findById(id, organizationId) {
        const [result] = await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            companyName: entities_1.entities.name,
            customerId: entities_1.entities.code,
            contactEmail: entities_1.entities.email,
            contactPhone: entities_1.entities.phone,
            status: entities_1.entities.status,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            // Address fields from joined table
            billingAddress: addresses_1.addresses.id ? (0, drizzle_orm_1.sql) `
          jsonb_build_object(
            'line1', ${addresses_1.addresses.line1},
            'line2', ${addresses_1.addresses.line2},
            'city', ${addresses_1.addresses.city},
            'state', ${addresses_1.addresses.stateProvince},
            'postalCode', ${addresses_1.addresses.postalCode},
            'country', ${addresses_1.addresses.countryCode}
          )
        ` : (0, drizzle_orm_1.sql) `null`,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Customer'])))
            .limit(1);
        if (!result) {
            return null;
        }
        return result;
    }
    /**
     * Find all customers for an organization with pagination and filtering
     */
    async findAll(organizationId, params = {}, filters = {}) {
        // Calculate pagination
        const page = Math.max(1, params.page || 1);
        const limit = Math.max(1, Math.min(100, params.limit || 20));
        const skip = (page - 1) * limit;
        // Build the where clause
        let whereConditions = [
            (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId),
            (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Customer'])
        ];
        if (filters.status) {
            whereConditions.push((0, drizzle_orm_1.eq)(entities_1.entities.status, filters.status));
        }
        const whereClause = (0, drizzle_orm_1.and)(...whereConditions);
        // Get the total count
        const countResult = await this.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(entities_1.entities)
            .where(whereClause);
        const count = Number(countResult[0]?.count || 0);
        // Get the paginated results with ordering
        const orderBy = params.orderBy || 'companyName';
        const orderDirection = params.orderDirection || 'asc';
        const orderColumn = orderBy === 'companyName' ? entities_1.entities.name : entities_1.entities.createdAt;
        const orderFunc = orderDirection === 'asc' ? drizzle_orm_1.asc : drizzle_orm_1.desc;
        const results = await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            companyName: entities_1.entities.name,
            customerId: entities_1.entities.code,
            contactEmail: entities_1.entities.email,
            contactPhone: entities_1.entities.phone,
            status: entities_1.entities.status,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            // Address fields from joined table
            billingAddress: addresses_1.addresses.id ? (0, drizzle_orm_1.sql) `
          jsonb_build_object(
            'line1', ${addresses_1.addresses.line1},
            'line2', ${addresses_1.addresses.line2},
            'city', ${addresses_1.addresses.city},
            'state', ${addresses_1.addresses.stateProvince},
            'postalCode', ${addresses_1.addresses.postalCode},
            'country', ${addresses_1.addresses.countryCode}
          )
        ` : (0, drizzle_orm_1.sql) `null`,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where(whereClause)
            .orderBy(orderFunc(orderColumn))
            .limit(limit)
            .offset(skip);
        return {
            data: results,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    }
    /**
     * Create a new customer
     */
    async create(data) {
        // First create address if billing address is provided
        let addressId = null;
        if (data.billingAddress) {
            const addr = typeof data.billingAddress === 'string' ?
                JSON.parse(data.billingAddress) : data.billingAddress;
            if (addr && (addr.line1 || addr.city)) {
                const [addressResult] = await this.db
                    .insert(addresses_1.addresses)
                    .values({
                    organizationId: data.organizationId,
                    addressee: addr.addressee || data.companyName,
                    companyName: addr.companyName || data.companyName,
                    attention: addr.attention,
                    phoneNumber: addr.phoneNumber || data.contactPhone,
                    line1: addr.line1 || addr.addressLine1,
                    line2: addr.line2 || addr.addressLine2,
                    city: addr.city,
                    stateProvince: addr.state || addr.stateProvince,
                    postalCode: addr.postalCode,
                    countryCode: addr.country || addr.countryCode,
                })
                    .returning();
                addressId = addressResult.id;
            }
        }
        // Insert the new customer entity
        const [result] = await this.db
            .insert(entities_1.entities)
            .values({
            organizationId: data.organizationId,
            name: data.companyName,
            code: data.customerId,
            email: data.contactEmail,
            phone: data.contactPhone,
            status: data.status || 'active',
            entityTypes: ['Customer'],
            addressId: addressId,
            isActive: true,
        })
            .returning();
        // Return in the expected format
        return {
            id: result.id,
            organizationId: result.organizationId,
            companyName: result.name,
            customerId: result.code,
            contactEmail: result.email,
            contactPhone: result.phone,
            status: result.status,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            billingAddress: addressId ? data.billingAddress : null,
        };
    }
    /**
     * Update an existing customer
     */
    async update(id, data, organizationId) {
        // Get existing customer first
        const existing = await this.findById(id, organizationId);
        if (!existing) {
            return null;
        }
        // Handle address update if needed
        let addressId = undefined;
        if (data.billingAddress !== undefined) {
            // TODO: Update or create address
            // For now, we'll skip address updates
        }
        // Update the customer entity
        const updateData = {
            updatedAt: new Date()
        };
        if (data.companyName !== undefined)
            updateData.name = data.companyName;
        if (data.customerId !== undefined)
            updateData.code = data.customerId;
        if (data.contactEmail !== undefined)
            updateData.email = data.contactEmail;
        if (data.contactPhone !== undefined)
            updateData.phone = data.contactPhone;
        if (data.status !== undefined)
            updateData.status = data.status;
        const [result] = await this.db
            .update(entities_1.entities)
            .set(updateData)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Customer'])))
            .returning();
        if (!result) {
            return null;
        }
        // Return in the expected format
        return {
            id: result.id,
            organizationId: result.organizationId,
            companyName: result.name,
            customerId: result.code,
            contactEmail: result.email,
            contactPhone: result.phone,
            status: result.status,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            billingAddress: existing.billingAddress,
        };
    }
    /**
     * Delete a customer
     */
    async delete(id, organizationId) {
        await this.db
            .delete(entities_1.entities)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.id, id), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Customer'])));
    }
    /**
     * Find a customer by customerId (the business ID, not the UUID)
     */
    async findByCustomerId(customerId, organizationId) {
        const [result] = await this.db
            .select({
            id: entities_1.entities.id,
            organizationId: entities_1.entities.organizationId,
            companyName: entities_1.entities.name,
            customerId: entities_1.entities.code,
            contactEmail: entities_1.entities.email,
            contactPhone: entities_1.entities.phone,
            status: entities_1.entities.status,
            createdAt: entities_1.entities.createdAt,
            updatedAt: entities_1.entities.updatedAt,
            // Address fields from joined table
            billingAddress: addresses_1.addresses.id ? (0, drizzle_orm_1.sql) `
          jsonb_build_object(
            'line1', ${addresses_1.addresses.line1},
            'line2', ${addresses_1.addresses.line2},
            'city', ${addresses_1.addresses.city},
            'state', ${addresses_1.addresses.stateProvince},
            'postalCode', ${addresses_1.addresses.postalCode},
            'country', ${addresses_1.addresses.countryCode}
          )
        ` : (0, drizzle_orm_1.sql) `null`,
        })
            .from(entities_1.entities)
            .leftJoin(addresses_1.addresses, (0, drizzle_orm_1.eq)(entities_1.entities.addressId, addresses_1.addresses.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(entities_1.entities.code, customerId), (0, drizzle_orm_1.eq)(entities_1.entities.organizationId, organizationId), (0, drizzle_orm_1.arrayContains)(entities_1.entities.entityTypes, ['Customer'])))
            .limit(1);
        if (!result) {
            return null;
        }
        return result;
    }
}
exports.CustomerRepository = CustomerRepository;
//# sourceMappingURL=customer-repository.js.map