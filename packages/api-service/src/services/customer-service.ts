import { BaseService } from './base-service';
import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  PaginationParams,
  PaginatedResult,
  ServiceError
} from '../types';
import { CustomerRepository, type ContextualDatabase } from '@glapi/database';

export interface CustomerServiceOptions {
  db?: ContextualDatabase;
}

export class CustomerService extends BaseService {
  private customerRepository: CustomerRepository;

  constructor(context = {}, options: CustomerServiceOptions = {}) {
    super(context);
    // Pass the contextual db to the repository for RLS support
    this.customerRepository = new CustomerRepository(options.db);
  }

  /**
   * Transform database customer to service layer type
   */
  private transformCustomer(dbCustomer: any): Customer {
    return {
      id: dbCustomer.id,
      organizationId: dbCustomer.organizationId,
      companyName: dbCustomer.companyName,
      customerId: dbCustomer.customerId || undefined,
      contactEmail: dbCustomer.contactEmail || undefined,
      contactPhone: dbCustomer.contactPhone || undefined,
      parentCustomerId: dbCustomer.parentCustomerId || undefined,
      status: dbCustomer.status as 'active' | 'inactive' | 'archived',
      billingAddress: dbCustomer.billingAddress || undefined,
      createdAt: dbCustomer.createdAt || new Date(),
      updatedAt: dbCustomer.updatedAt || new Date(),
    };
  }
  
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
    
    const result = await this.customerRepository.findAll(
      organizationId,
      {
        page: params.page,
        limit: params.limit,
        orderBy,
        orderDirection
      },
      filters
    );
    
    return {
      ...result,
      data: result.data.map(c => this.transformCustomer(c))
    };
  }
  
  /**
   * Get a customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const organizationId = this.requireOrganizationContext();
    const customer = await this.customerRepository.findById(id, organizationId);
    return customer ? this.transformCustomer(customer) : null;
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
    
    // Check if customer ID already exists in this organization (only if customerId is provided)
    if (data.customerId) {
      const existing = await this.customerRepository.findByCustomerId(data.customerId, organizationId);
      if (existing) {
        throw new ServiceError(
          `Customer with ID "${data.customerId}" already exists in this organization`,
          'DUPLICATE_CUSTOMER_ID',
          400
        );
      }
    }
    
    // Create the customer
    const customer = await this.customerRepository.create(data);
    return this.transformCustomer(customer);
  }
  
  /**
   * Update an existing customer
   */
  async updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if customer exists and belongs to the organization
    const existing = await this.customerRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Customer with ID "${id}" not found`,
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    // Update the customer
    const result = await this.customerRepository.update(id, data, organizationId);
    
    if (!result) {
      throw new ServiceError(
        `Failed to update customer with ID "${id}"`,
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformCustomer(result);
  }
  
  /**
   * Delete a customer
   */
  async deleteCustomer(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Check if customer exists and belongs to the organization
    const existing = await this.customerRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        `Customer with ID "${id}" not found`,
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    // Delete the customer
    await this.customerRepository.delete(id, organizationId);
  }

  /**
   * Get child customers for a parent customer
   */
  async getChildCustomers(parentId: string): Promise<Customer[]> {
    const organizationId = this.requireOrganizationContext();
    
    const children = await this.customerRepository.findByParentId(parentId, organizationId);
    return children.map(c => this.transformCustomer(c));
  }
}