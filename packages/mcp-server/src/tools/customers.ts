import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for customer from the API
interface Customer {
  id?: string;
  organizationId: string;
  companyName: string;
  customerId?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: 'active' | 'inactive' | 'archived';
  billingAddress?: any;
  parentCustomerId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register customer management tools
 */
export function registerCustomerTools(server: MCPServer): void {
  // List customers
  server.registerTool(
    {
      name: 'list_customers',
      description: 'Retrieve and search customer records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for customer name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by customer status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of customers to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'customers:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const customers: Customer[] = await client.customers.list.query({
          includeInactive: args.status === 'all' || args.status === 'inactive',
        });
        
        // Filter customers based on search term if provided
        let filteredCustomers = customers;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredCustomers = customers.filter((customer: Customer) => 
            customer.companyName.toLowerCase().includes(searchLower) ||
            (customer.contactEmail && customer.contactEmail.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply status filter
        if (args.status === 'active') {
          filteredCustomers = filteredCustomers.filter((c: Customer) => c.status === 'active');
        } else if (args.status === 'inactive') {
          filteredCustomers = filteredCustomers.filter((c: Customer) => c.status === 'inactive');
        }
        
        // Apply limit
        const limitedCustomers = filteredCustomers.slice(0, args.limit || 50);
        
        if (limitedCustomers.length === 0) {
          return createToolResponse('No customers found matching the criteria.');
        }
        
        const summary = `Found ${limitedCustomers.length} customer(s):`;
        
        return createDataResponse(summary, {
          customers: limitedCustomers.map((customer: Customer) => ({
            id: customer.id,
            name: customer.companyName,
            email: customer.contactEmail || 'N/A',
            phone: customer.contactPhone || 'N/A',
            status: customer.status,
            customerId: customer.customerId,
            createdAt: customer.createdAt,
          })),
        });
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get customer by ID
  server.registerTool(
    {
      name: 'get_customer',
      description: 'Get detailed information for a specific customer',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Customer ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'customers:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const customer: Customer = await client.customers.get.query({ id: args.id });
        
        return createDataResponse(
          `Customer details for ${customer.companyName}:`,
          {
            id: customer.id,
            name: customer.companyName,
            customerId: customer.customerId,
            email: customer.contactEmail || 'N/A',
            phone: customer.contactPhone || 'N/A',
            status: customer.status,
            billingAddress: customer.billingAddress,
            parentCustomerId: customer.parentCustomerId,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create new customer
  server.registerTool(
    {
      name: 'create_customer',
      description: 'Create a new customer record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Customer name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Customers Tool] Create customer called with:', args);
        console.log('[Customers Tool] Context org:', context.organizationId);
        console.log('[Customers Tool] API URL:', context.env.GLAPI_API_URL);
        
        checkPermission(context, 'customers:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        console.log('[Customers Tool] Calling tRPC to create customer...');
        const customer: Customer = await client.customers.create.mutate({
          companyName: args.name,
          contactEmail: args.email || undefined,
          contactPhone: args.phone || undefined,
          status: 'active',
        });
        console.log('[Customers Tool] Customer created:', customer);
        
        return createDataResponse(
          `✅ Successfully created customer "${customer.companyName}"`,
          {
            id: customer.id,
            name: customer.companyName,
            email: customer.contactEmail || 'N/A',
            phone: customer.contactPhone || 'N/A',
            status: customer.status,
            customerId: customer.customerId,
            createdAt: customer.createdAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update customer
  server.registerTool(
    {
      name: 'update_customer',
      description: 'Update an existing customer record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Customer ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Customer name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Customer status',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Customers Tool] Update customer called with:', args);
        
        checkPermission(context, 'customers:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Build update data - only include fields that were provided
        const updateData: any = {};
        if (args.name !== undefined) updateData.companyName = args.name;
        if (args.email !== undefined) updateData.contactEmail = args.email;
        if (args.phone !== undefined) updateData.contactPhone = args.phone;
        if (args.status !== undefined) updateData.status = args.status;
        
        console.log('[Customers Tool] Calling tRPC to update customer...');
        const customer: Customer = await client.customers.update.mutate({
          id: args.id,
          data: updateData,
        });
        console.log('[Customers Tool] Customer updated:', customer);
        
        return createDataResponse(
          `✅ Successfully updated customer "${customer.companyName}"`,
          {
            id: customer.id,
            name: customer.companyName,
            email: customer.contactEmail || 'N/A',
            phone: customer.contactPhone || 'N/A',
            status: customer.status,
            customerId: customer.customerId,
            updatedAt: customer.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}