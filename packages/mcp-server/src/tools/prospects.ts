import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for prospect from the API
interface Prospect {
  id?: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  entityId?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  metadata?: {
    prospect_source?: string;
    prospect_status?: string;
    qualification_score?: number;
    next_action?: string;
    follow_up_date?: string;
    industry?: string;
    annualRevenue?: number;
    numberOfEmployees?: number;
    assignedTo?: string;
  } | null;
  status?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register prospect management tools
 */
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
          isActive: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of prospects to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
          page: {
            type: 'number',
            description: 'Page number for pagination',
            default: 1,
            minimum: 1,
          },
        },
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'read', 'prospects')) {
        return createToolResponse('Permission denied: cannot read prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const result = await client.prospects.list.query({
          search: args.search,
          isActive: args.isActive,
          limit: args.limit || 50,
          page: args.page || 1,
        });

        return createDataResponse(
          `Found ${result.total} prospects (showing ${result.data.length})`,
          result
        );
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Get single prospect
  server.registerTool(
    {
      name: 'get_prospect',
      description: 'Retrieve a single prospect by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The prospect ID',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'read', 'prospects')) {
        return createToolResponse('Permission denied: cannot read prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const prospect = await client.prospects.getById.query({ id: args.id });

        if (!prospect) {
          return createToolResponse('Prospect not found', true);
        }

        return createDataResponse('Prospect retrieved successfully', prospect);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
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
            description: 'Company name',
          },
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          website: {
            type: 'string',
            description: 'Company website',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
          metadata: {
            type: 'object',
            properties: {
              prospect_source: {
                type: 'string',
                description: 'Source of the prospect',
              },
              industry: {
                type: 'string',
                description: 'Industry sector',
              },
              annualRevenue: {
                type: 'number',
                description: 'Estimated annual revenue',
              },
              numberOfEmployees: {
                type: 'number',
                description: 'Number of employees',
              },
              assignedTo: {
                type: 'string',
                description: 'Assigned sales person',
              },
            },
          },
        },
        required: ['name'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'prospects')) {
        return createToolResponse('Permission denied: cannot create prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const prospect = await client.prospects.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          website: args.website,
          notes: args.notes,
          isActive: true,
          metadata: args.metadata,
        });

        return createDataResponse('Prospect created successfully', prospect);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
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
            description: 'The prospect ID to update',
          },
          name: {
            type: 'string',
            description: 'Company name',
          },
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          website: {
            type: 'string',
            description: 'Company website',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the prospect is active',
          },
          metadata: {
            type: 'object',
            properties: {
              prospect_source: {
                type: 'string',
                description: 'Source of the prospect',
              },
              prospect_status: {
                type: 'string',
                description: 'Current status',
              },
              qualification_score: {
                type: 'number',
                description: 'Qualification score (0-100)',
              },
              next_action: {
                type: 'string',
                description: 'Next action to take',
              },
              follow_up_date: {
                type: 'string',
                description: 'Follow-up date',
              },
              industry: {
                type: 'string',
                description: 'Industry sector',
              },
              annualRevenue: {
                type: 'number',
                description: 'Estimated annual revenue',
              },
              numberOfEmployees: {
                type: 'number',
                description: 'Number of employees',
              },
              assignedTo: {
                type: 'string',
                description: 'Assigned sales person',
              },
            },
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'prospects')) {
        return createToolResponse('Permission denied: cannot update prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const { id, ...data } = args;
        const prospect = await client.prospects.update.mutate({
          id,
          data,
        });

        return createDataResponse('Prospect updated successfully', prospect);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Delete prospect
  server.registerTool(
    {
      name: 'delete_prospect',
      description: 'Delete a prospect record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The prospect ID to delete',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'prospects')) {
        return createToolResponse('Permission denied: cannot delete prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        await client.prospects.delete.mutate({ id: args.id });

        return createToolResponse('Prospect deleted successfully');
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Convert prospect to lead
  server.registerTool(
    {
      name: 'convert_prospect_to_lead',
      description: 'Convert a prospect to a lead',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The prospect ID to convert',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'prospects')) {
        return createToolResponse('Permission denied: cannot convert prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const lead = await client.prospects.convertToLead.mutate({ id: args.id });

        return createDataResponse('Prospect converted to lead successfully', lead);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Convert prospect to customer
  server.registerTool(
    {
      name: 'convert_prospect_to_customer',
      description: 'Convert a prospect directly to a customer',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The prospect ID to convert',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'prospects')) {
        return createToolResponse('Permission denied: cannot convert prospects', true);
      }

      try {
        const client = await createBackendClient(context);
        const customer = await client.prospects.convertToCustomer.mutate({ id: args.id });

        return createDataResponse('Prospect converted to customer successfully', customer);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );
}