import { BaseService } from './base-service';
import { 
  Customer, 
  CreateCustomerInput, 
  UpdateCustomerInput, 
  PaginationParams, 
  PaginatedResult,
  ServiceError
} from '../types';
import { CustomerRepository } from '@glapi/database/src/repositories/customer-repository';

export class CustomerService extends BaseService {
  private customerRepository: CustomerRepository;
  
  constructor(context = {}) {
    super(context);
    this.customerRepository = new CustomerRepository();
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
    
    return result;
  }
  
  /**
   * Get a customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const organizationId = this.requireOrganizationContext();
    return await this.customerRepository.findById(id, organizationId);
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
    return await this.customerRepository.create(data);
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
    
    return result;
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
}