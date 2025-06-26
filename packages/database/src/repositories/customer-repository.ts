import { and, asc, desc, eq, sql, arrayContains } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { entities } from '../db/schema/entities';
import { addresses } from '../db/schema/addresses';

export interface CustomerPaginationParams {
  page?: number;
  limit?: number;
  orderBy?: 'companyName' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export class CustomerRepository extends BaseRepository {
  /**
   * Find a customer by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        companyName: entities.name,
        customerId: entities.code,
        contactEmail: entities.email,
        contactPhone: entities.phone,
        parentCustomerId: entities.parentEntityId,
        status: entities.status,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        // Address fields from joined table
        billingAddress: addresses.id ? sql`
          jsonb_build_object(
            'line1', ${addresses.line1},
            'line2', ${addresses.line2},
            'city', ${addresses.city},
            'state', ${addresses.stateProvince},
            'postalCode', ${addresses.postalCode},
            'country', ${addresses.countryCode}
          )
        ` : sql`null`,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId),
          arrayContains(entities.entityTypes, ['Customer'])
        )
      )
      .limit(1);
    
    if (!result) {
      return null;
    }
    
    return result;
  }
  
  /**
   * Find all customers for an organization with pagination and filtering
   */
  async findAll(
    organizationId: string,
    params: CustomerPaginationParams = {},
    filters: { status?: string } = {}
  ) {
    // Calculate pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;
    
    // Build the where clause
    let whereConditions = [
      eq(entities.organizationId, organizationId),
      arrayContains(entities.entityTypes, ['Customer'])
    ];
    
    if (filters.status) {
      whereConditions.push(eq(entities.status, filters.status));
    }
    
    const whereClause = and(...whereConditions);
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(entities)
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'companyName';
    const orderDirection = params.orderDirection || 'asc';
    const orderColumn = orderBy === 'companyName' ? entities.name : entities.createdAt;
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        companyName: entities.name,
        customerId: entities.code,
        contactEmail: entities.email,
        contactPhone: entities.phone,
        parentCustomerId: entities.parentEntityId,
        status: entities.status,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        // Address fields from joined table
        billingAddress: addresses.id ? sql`
          jsonb_build_object(
            'line1', ${addresses.line1},
            'line2', ${addresses.line2},
            'city', ${addresses.city},
            'state', ${addresses.stateProvince},
            'postalCode', ${addresses.postalCode},
            'country', ${addresses.countryCode}
          )
        ` : sql`null`,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
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
   * Find customers by parent ID
   */
  async findByParentId(parentId: string, organizationId: string) {
    const results = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        companyName: entities.name,
        customerId: entities.code,
        contactEmail: entities.email,
        contactPhone: entities.phone,
        parentCustomerId: entities.parentEntityId,
        status: entities.status,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        // Address fields from joined table
        billingAddress: addresses.id ? sql`
          jsonb_build_object(
            'line1', ${addresses.line1},
            'line2', ${addresses.line2},
            'city', ${addresses.city},
            'state', ${addresses.stateProvince},
            'postalCode', ${addresses.postalCode},
            'country', ${addresses.countryCode}
          )
        ` : sql`null`,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.parentEntityId, parentId),
          eq(entities.organizationId, organizationId),
          arrayContains(entities.entityTypes, ['Customer'])
        )
      );
    
    return results;
  }
  
  /**
   * Create a new customer
   */
  async create(data: any) {
    // First create address if billing address is provided
    let addressId = null;
    if (data.billingAddress) {
      const addr = typeof data.billingAddress === 'string' ? 
        JSON.parse(data.billingAddress) : data.billingAddress;
      
      if (addr && (addr.line1 || addr.city)) {
        const [addressResult] = await this.db
          .insert(addresses)
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
      .insert(entities)
      .values({
        organizationId: data.organizationId,
        name: data.companyName,
        code: data.customerId,
        email: data.contactEmail,
        phone: data.contactPhone,
        status: data.status || 'active',
        entityTypes: ['Customer'],
        addressId: addressId,
        parentEntityId: data.parentCustomerId,
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
      parentCustomerId: result.parentEntityId,
      status: result.status,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      billingAddress: addressId ? data.billingAddress : null,
    };
  }
  
  /**
   * Update an existing customer
   */
  async update(id: string, data: any, organizationId: string) {
    // Get existing customer first
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      return null;
    }
    
    // Handle address update if needed
    if (data.billingAddress !== undefined) {
      // TODO: Update or create address
      // For now, we'll skip address updates
    }
    
    // Update the customer entity
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (data.companyName !== undefined) updateData.name = data.companyName;
    if (data.customerId !== undefined) updateData.code = data.customerId;
    if (data.contactEmail !== undefined) updateData.email = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.phone = data.contactPhone;
    if (data.parentCustomerId !== undefined) updateData.parentEntityId = data.parentCustomerId || null;
    if (data.status !== undefined) updateData.status = data.status;
    
    const [result] = await this.db
      .update(entities)
      .set(updateData)
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId),
          arrayContains(entities.entityTypes, ['Customer'])
        )
      )
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
      parentCustomerId: result.parentEntityId,
      status: result.status,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      billingAddress: existing.billingAddress,
    };
  }
  
  /**
   * Delete a customer
   */
  async delete(id: string, organizationId: string) {
    await this.db
      .delete(entities)
      .where(
        and(
          eq(entities.id, id),
          eq(entities.organizationId, organizationId),
          arrayContains(entities.entityTypes, ['Customer'])
        )
      );
  }
  
  /**
   * Find a customer by customerId (the business ID, not the UUID)
   */
  async findByCustomerId(customerId: string, organizationId: string) {
    const [result] = await this.db
      .select({
        id: entities.id,
        organizationId: entities.organizationId,
        companyName: entities.name,
        customerId: entities.code,
        contactEmail: entities.email,
        contactPhone: entities.phone,
        parentCustomerId: entities.parentEntityId,
        status: entities.status,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
        // Address fields from joined table
        billingAddress: addresses.id ? sql`
          jsonb_build_object(
            'line1', ${addresses.line1},
            'line2', ${addresses.line2},
            'city', ${addresses.city},
            'state', ${addresses.stateProvince},
            'postalCode', ${addresses.postalCode},
            'country', ${addresses.countryCode}
          )
        ` : sql`null`,
      })
      .from(entities)
      .leftJoin(addresses, eq(entities.addressId, addresses.id))
      .where(
        and(
          eq(entities.code, customerId),
          eq(entities.organizationId, organizationId),
          arrayContains(entities.entityTypes, ['Customer'])
        )
      )
      .limit(1);
    
    if (!result) {
      return null;
    }
    
    return result;
  }
}