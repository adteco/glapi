import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for entity list response
interface EntityListResponse {
  data: BaseEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Type for lead from the API (BaseEntity)
interface BaseEntity {
  id: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  entityTypes: string[];
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: any;
  parentEntityId?: string | null;
  primaryContactId?: string | null;
  taxId?: string | null;
  description?: string | null;
  notes?: string | null;
  customFields?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  status: 'active' | 'inactive' | 'archived';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function registerLeadTools(server: MCPServer): void {
  // List leads
  server.registerTool(
    {
      name: 'list_leads',
      description: 'Retrieve and search lead records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for lead name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by lead status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of leads to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const result: EntityListResponse = await client.leads.list.query({
          search: args.search,
          isActive: args.status === 'all' ? undefined : args.status === 'active',
          limit: args.limit || 50,
          page: 1,
        });

        const leads = result.data;
        
        if (leads.length === 0) {
          return createToolResponse('No leads found matching the criteria.');
        }

        const summary = `Found ${leads.length} lead(s):`;
        
        return createDataResponse(summary, {
          total: result.total,
          leads: leads.map(lead => ({
            id: lead.id,
            name: lead.name,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            status: lead.status,
            type: lead.entityTypes.join(', '),
            metadata: lead.metadata || {},
            createdAt: lead.createdAt,
          })),
        });
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get lead details
  server.registerTool(
    {
      name: 'get_lead',
      description: 'Get detailed information for a specific lead',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Lead ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const lead = await client.leads.getById.query({ id: args.id });
        
        if (!lead) {
          return createToolResponse(`Lead with ID ${args.id} not found`, true);
        }
        
        return createDataResponse(
          `Lead details for ${lead.name}:`,
          {
            id: lead.id,
            name: lead.name,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            website: lead.website || 'N/A',
            status: lead.status,
            type: lead.entityTypes.join(', '),
            notes: lead.notes || 'N/A',
            metadata: lead.metadata || {},
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create lead
  server.registerTool(
    {
      name: 'create_lead',
      description: 'Create a new lead record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Lead name or company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Lead email address',
          },
          phone: {
            type: 'string',
            description: 'Lead phone number',
          },
          website: {
            type: 'string',
            description: 'Lead website',
          },
          source: {
            type: 'string',
            description: 'Lead source (e.g., Website, Referral, Trade Show)',
          },
          notes: {
            type: 'string',
            description: 'Notes about the lead',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const lead: BaseEntity = await client.leads.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          website: args.website,
          notes: args.notes,
          isActive: true,
          metadata: {
            lead_source: args.source,
          },
        });
        
        return createDataResponse(
          `Successfully created lead: ${lead.name}`,
          {
            id: lead.id,
            name: lead.name,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            status: lead.status,
            metadata: lead.metadata || {},
            createdAt: lead.createdAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update lead
  server.registerTool(
    {
      name: 'update_lead',
      description: 'Update an existing lead record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Lead ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Lead name or company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Lead email address',
          },
          phone: {
            type: 'string',
            description: 'Lead phone number',
          },
          website: {
            type: 'string',
            description: 'Lead website',
          },
          source: {
            type: 'string',
            description: 'Lead source (e.g., Website, Referral, Trade Show)',
          },
          notes: {
            type: 'string',
            description: 'Notes about the lead',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Lead status',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const updateData: any = {};
        if (args.name !== undefined) updateData.name = args.name;
        if (args.email !== undefined) updateData.email = args.email;
        if (args.phone !== undefined) updateData.phone = args.phone;
        if (args.website !== undefined) updateData.website = args.website;
        if (args.notes !== undefined) updateData.notes = args.notes;
        if (args.status !== undefined) {
          updateData.status = args.status;
          updateData.isActive = args.status === 'active';
        }
        
        // Handle metadata updates
        if (args.source !== undefined) {
          updateData.metadata = {
            lead_source: args.source,
          };
        }
        
        const lead: BaseEntity = await client.leads.update.mutate({
          id: args.id,
          data: updateData,
        });
        
        return createDataResponse(
          `Successfully updated lead: ${lead.name}`,
          {
            id: lead.id,
            name: lead.name,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            status: lead.status,
            metadata: lead.metadata || {},
            updatedAt: lead.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Convert lead to customer
  server.registerTool(
    {
      name: 'convert_lead_to_customer',
      description: 'Convert a lead to a customer',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Lead ID (UUID) to convert',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:update');
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get the lead details first
        const lead = await client.leads.getById.query({ id: args.id });
        
        if (!lead) {
          return createToolResponse(`Lead with ID ${args.id} not found`, true);
        }
        
        // Create customer with lead data
        const customer = await client.customers.create.mutate({
          companyName: lead.name,
          contactEmail: lead.email,
          contactPhone: lead.phone,
          status: 'active',
        });
        
        // Archive the lead
        await client.leads.update.mutate({
          id: args.id,
          data: {
            isActive: false,
            notes: `${lead.notes || ''}\n\nConverted to customer ${customer.id} on ${new Date().toISOString()}`,
          },
        });
        
        return createDataResponse(
          `Successfully converted lead "${lead.name}" to customer`,
          {
            customerId: customer.id,
            customerName: customer.companyName,
            originalLeadId: lead.id,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  console.log('Lead tools registered successfully');
}