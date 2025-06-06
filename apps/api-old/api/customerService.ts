/**
 * Simple mock CustomerService implementation for development
 * This replaces the real CustomerService from @glapi/api-service
 */

// Mock database for customers
const customers: Record<string, any> = {};

export class CustomerService {
  private context: { organizationId: string; userId: string };

  constructor(context: { organizationId: string; userId: string }) {
    this.context = context;
  }

  async createCustomer(data: any) {
    const id = `cust-${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    
    const customer = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    };
    
    // Store in our mock database
    customers[id] = customer;
    
    return { customer };
  }

  async getCustomerById(id: string) {
    const customer = customers[id];
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }
    
    return { customer };
  }

  async updateCustomer(id: string, data: any) {
    const customer = customers[id];
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }
    
    // Update customer
    const updatedCustomer = {
      ...customer,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // Store in our mock database
    customers[id] = updatedCustomer;
    
    return { customer: updatedCustomer };
  }

  async deleteCustomer(id: string) {
    const customer = customers[id];
    if (!customer) {
      throw new Error(`Customer not found: ${id}`);
    }
    
    // Delete from our mock database
    delete customers[id];
    
    return { success: true };
  }

  async listCustomers(params: any = {}) {
    const { page = 1, limit = 10, orderBy = 'createdAt', orderDirection = 'desc', status } = params;
    
    // Filter customers by organization ID
    const orgCustomers = Object.values(customers).filter((customer: any) => 
      customer.organizationId === this.context.organizationId
    );
    
    // Apply status filter if provided
    const filteredCustomers = status 
      ? orgCustomers.filter((customer: any) => customer.status === status)
      : orgCustomers;
    
    // Sort customers
    const sortedCustomers = [...filteredCustomers].sort((a: any, b: any) => {
      if (orderDirection === 'asc') {
        return a[orderBy] > b[orderBy] ? 1 : -1;
      } else {
        return a[orderBy] < b[orderBy] ? 1 : -1;
      }
    });
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);
    
    return {
      data: paginatedCustomers,
      total: filteredCustomers.length,
      page,
      limit,
      totalPages: Math.ceil(filteredCustomers.length / limit)
    };
  }
}