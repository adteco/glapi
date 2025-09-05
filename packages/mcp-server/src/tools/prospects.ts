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

// Type for prospect from the API (BaseEntity)
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

export function registerProspectTools(server: MCPServer): void {
  // List prospects
  server.registerTool(
    {
      name: 'list_prospects',
      description: 'Retrieve and search prospect records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for prospect name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by prospect status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of prospects to return',
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
        
        const result: EntityListResponse = await client.prospects.list.query({
          search: args.search,
          isActive: args.status === 'all' ? undefined : args.status === 'active',
          limit: args.limit || 50,
          page: 1,
        });

        const prospects = result.data;
        
        if (prospects.length === 0) {
          return createToolResponse('No prospects found matching the criteria.');
        }

        const summary = `Found ${prospects.length} prospect(s):`;
        
        return createDataResponse(summary, {
          total: result.total,
          prospects: prospects.map(prospect => ({
            id: prospect.id,
            name: prospect.name,
            email: prospect.email || 'N/A',
            phone: prospect.phone || 'N/A',
            status: prospect.status,
            type: prospect.entityTypes.join(', '),
            metadata: prospect.metadata || {},
            createdAt: prospect.createdAt,
          })),
        });
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get prospect details
  server.registerTool(
    {
      name: 'get_prospect',
      description: 'Get detailed information for a specific prospect',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Prospect ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const prospect = await client.prospects.getById.query({ id: args.id });
        
        if (!prospect) {
          return createToolResponse(`Prospect with ID ${args.id} not found`, true);
        }
        
        return createDataResponse(
          `Prospect details for ${prospect.name}:`,
          {
            id: prospect.id,
            name: prospect.name,
            email: prospect.email || 'N/A',
            phone: prospect.phone || 'N/A',
            website: prospect.website || 'N/A',
            status: prospect.status,
            type: prospect.entityTypes.join(', '),
            notes: prospect.notes || 'N/A',
            metadata: prospect.metadata || {},
            createdAt: prospect.createdAt,
            updatedAt: prospect.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create prospect
  server.registerTool(
    {
      name: 'create_prospect',
      description: 'Create a new prospect record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Prospect name or company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Prospect email address',
          },
          phone: {
            type: 'string',
            description: 'Prospect phone number',
          },
          website: {
            type: 'string',
            description: 'Prospect website',
          },
          source: {
            type: 'string',
            description: 'Prospect source (e.g., Marketing Campaign, Cold Outreach)',
          },
          stage: {
            type: 'string',
            description: 'Sales stage (e.g., Qualification, Negotiation)',
          },
          notes: {
            type: 'string',
            description: 'Notes about the prospect',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const prospect: BaseEntity = await client.prospects.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          website: args.website,
          notes: args.notes,
          isActive: true,
          metadata: {
            prospect_source: args.source,
            prospect_status: args.stage,
          },
        });
        
        return createDataResponse(
          `Successfully created prospect: ${prospect.name}`,
          {
            id: prospect.id,
            name: prospect.name,
            email: prospect.email || 'N/A',
            phone: prospect.phone || 'N/A',
            status: prospect.status,
            metadata: prospect.metadata || {},
            createdAt: prospect.createdAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update prospect
  server.registerTool(
    {
      name: 'update_prospect',
      description: 'Update an existing prospect record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Prospect ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Prospect name or company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Prospect email address',
          },
          phone: {
            type: 'string',
            description: 'Prospect phone number',
          },
          website: {
            type: 'string',
            description: 'Prospect website',
          },
          source: {
            type: 'string',
            description: 'Prospect source (e.g., Marketing Campaign, Cold Outreach)',
          },
          stage: {
            type: 'string',
            description: 'Sales stage (e.g., Qualification, Negotiation)',
          },
          notes: {
            type: 'string',
            description: 'Notes about the prospect',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Prospect status',
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
        if (args.source !== undefined || args.stage !== undefined) {
          updateData.metadata = {
            ...(args.source && { prospect_source: args.source }),
            ...(args.stage && { prospect_status: args.stage }),
          };
        }
        
        const prospect: BaseEntity = await client.prospects.update.mutate({
          id: args.id,
          data: updateData,
        });
        
        return createDataResponse(
          `Successfully updated prospect: ${prospect.name}`,
          {
            id: prospect.id,
            name: prospect.name,
            email: prospect.email || 'N/A',
            phone: prospect.phone || 'N/A',
            status: prospect.status,
            metadata: prospect.metadata || {},
            updatedAt: prospect.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Convert prospect to customer
  server.registerTool(
    {
      name: 'convert_prospect_to_customer',
      description: 'Convert a prospect to a customer',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Prospect ID (UUID) to convert',
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
        
        // Get the prospect details first
        const prospect = await client.prospects.getById.query({ id: args.id });
        
        if (!prospect) {
          return createToolResponse(`Prospect with ID ${args.id} not found`, true);
        }
        
        // Create customer with prospect data
        const customer = await client.customers.create.mutate({
          companyName: prospect.name,
          contactEmail: prospect.email,
          contactPhone: prospect.phone,
          status: 'active',
        });
        
        // Archive the prospect
        await client.prospects.update.mutate({
          id: args.id,
          data: {
            isActive: false,
            notes: `${prospect.notes || ''}\n\nConverted to customer ${customer.id} on ${new Date().toISOString()}`,
          },
        });
        
        return createDataResponse(
          `Successfully converted prospect "${prospect.name}" to customer`,
          {
            customerId: customer.id,
            customerName: customer.companyName,
            originalProspectId: prospect.id,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  console.log('Prospect tools registered successfully');
}