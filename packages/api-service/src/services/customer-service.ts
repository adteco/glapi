import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { BaseService } from './base-service';
import { 
  Customer, 
  CreateCustomerInput, 
  UpdateCustomerInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { customers } from '@glapi/database/src/db/schema/customers';

export class CustomerService extends BaseService {
  /**
   * Get a list of customers for the current organization
   */
  async listCustomers(
    params: PaginationParams = {},
    orderBy: 'companyName' | 'createdAt' = 'companyName',
    orderDirection: 'asc' | 'desc' = 'asc',
    filters: { status?: string } = {}
  ): Promise<PaginatedResult<Customer>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(params);
    
    // Build the where clause
    let whereClause = and(
      eq(customers.organizationId, organizationId)
    );
    
    if (filters.status) {
      whereClause = and(whereClause, eq(customers.status, filters.status));
    }
    
    // Get the total count
    const [{ count }] = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(customers)
      .where(whereClause);
    
    // Get the paginated results with ordering
    const orderColumn = orderBy === 'companyName' ? customers.companyName : customers.createdAt;
    const orderFunc = orderDirection === 'asc' ? asc : desc;
    
    const results = await this.db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(orderFunc(orderColumn))
      .limit(take)
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
    
    return this.createPaginatedResult(formattedResults, count, page, limit);
  }
  
  /**
   * Get a customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const organizationId = this.requireOrganizationContext();
    
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
   * Create a new customer
   */
  async createCustomer(data: CreateCustomerInput): Promise<Customer> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate that the organization ID matches the context
    if (data.organizationId !== organizationId) {
      throw new ServiceError(
        'OrganizationId must match the current context',
        'INVALID_ORGANIZATION_ID',
        400
      );
    }
    
    // Check if customer ID already exists in this organization
    const existing = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.customerId, data.customerId),
          eq(customers.organizationId, organizationId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      throw new ServiceError(
        `Customer with ID "${data.customerId}" already exists in this organization`,
        'DUPLICATE_CUSTOMER_ID',
        400
      );
    }
    
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
  async updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if customer exists and belongs to the organization
    const existing = await this.getCustomerById(id);
    if (!existing) {
      throw new ServiceError(
        `Customer with ID "${id}" not found`,
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
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
      throw new ServiceError(
        `Failed to update customer with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
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
  async deleteCustomer(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if customer exists and belongs to the organization
    const existing = await this.getCustomerById(id);
    if (!existing) {
      throw new ServiceError(
        `Customer with ID "${id}" not found`,
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    // Delete the customer
    await this.db
      .delete(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, organizationId)
        )
      );
  }
}