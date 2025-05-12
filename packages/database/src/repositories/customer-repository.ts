import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { customers } from '../db/schema/customers';

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
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (!result) {
      return null;
    }
    
    // Convert any jsonb fields to objects
    return {
      ...result,
      billingAddress: result.billingAddress ? 
        (typeof result.billingAddress === 'string' ? 
          JSON.parse(result.billingAddress) : 
          result.billingAddress) : 
        undefined
    };
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
    let whereClause = and(
      eq(customers.organizationId, organizationId)
    );
    
    if (filters.status) {
      whereClause = and(whereClause, eq(customers.status, filters.status));
    }
    
    // Get the total count
    const countResult = await this.db
      .select({ count: sql`COUNT(*)` })
      .from(customers)
      .where(whereClause);
    
    const count = Number(countResult[0]?.count || 0);
    
    // Get the paginated results with ordering
    const orderBy = params.orderBy || 'companyName';
    const orderDirection = params.orderDirection || 'asc';
    const orderColumn = orderBy === 'companyName' ? customers.companyName : customers.createdAt;
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(orderFunc(orderColumn))
      .limit(limit)
      .offset(skip);
    
    // Convert any jsonb fields to objects
    const formattedResults = results.map(customer => ({
      ...customer,
      billingAddress: customer.billingAddress ? 
        (typeof customer.billingAddress === 'string' ? 
          JSON.parse(customer.billingAddress) : 
          customer.billingAddress) : 
        undefined
    }));
    
    return {
      data: formattedResults,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }
  
  /**
   * Create a new customer
   */
  async create(data: any) {
    // Prepare the billing address as jsonb if present
    const billingAddress = data.billingAddress ? 
      (typeof data.billingAddress === 'string' ? 
        data.billingAddress : 
        JSON.stringify(data.billingAddress)) : 
      null;
    
    // Insert the new customer
    const [result] = await this.db
      .insert(customers)
      .values({
        ...data,
        billingAddress,
      })
      .returning();
    
    // Convert any jsonb fields back to objects
    return {
      ...result,
      billingAddress: result.billingAddress ? 
        (typeof result.billingAddress === 'string' ? 
          JSON.parse(result.billingAddress) : 
          result.billingAddress) : 
        undefined
    };
  }
  
  /**
   * Update an existing customer
   */
  async update(id: string, data: any, organizationId: string) {
    // Prepare the billing address as jsonb if present
    let billingAddress = undefined;
    if (data.billingAddress !== undefined) {
      billingAddress = data.billingAddress ? 
        (typeof data.billingAddress === 'string' ? 
          data.billingAddress : 
          JSON.stringify(data.billingAddress)) : 
        null;
    }
    
    // Update the customer
    const [result] = await this.db
      .update(customers)
      .set({
        ...data,
        billingAddress,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, organizationId)
        )
      )
      .returning();
    
    if (!result) {
      return null;
    }
    
    // Convert any jsonb fields back to objects
    return {
      ...result,
      billingAddress: result.billingAddress ? 
        (typeof result.billingAddress === 'string' ? 
          JSON.parse(result.billingAddress) : 
          result.billingAddress) : 
        undefined
    };
  }
  
  /**
   * Delete a customer
   */
  async delete(id: string, organizationId: string) {
    await this.db
      .delete(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, organizationId)
        )
      );
  }
  
  /**
   * Find a customer by customerId (the business ID, not the UUID)
   */
  async findByCustomerId(customerId: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.customerId, customerId),
          eq(customers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (!result) {
      return null;
    }
    
    // Convert any jsonb fields to objects
    return {
      ...result,
      billingAddress: result.billingAddress ? 
        (typeof result.billingAddress === 'string' ? 
          JSON.parse(result.billingAddress) : 
          result.billingAddress) : 
        undefined
    };
  }
}