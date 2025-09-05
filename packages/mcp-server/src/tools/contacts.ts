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

// Type for contact from the API (BaseEntity)
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

export function registerContactTools(server: MCPServer): void {
  // List contacts
  server.registerTool(
    {
      name: 'list_contacts',
      description: 'Retrieve and search contact records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for contact name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by contact status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of contacts to return',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    async (args: any, context: AuthContext) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const result: EntityListResponse = await client.contacts.list.query({
          search: args.search,
          isActive: args.status === 'all' ? undefined : args.status === 'active',
          limit: args.limit || 50,
          page: 1,
        });

        const contacts = result.data;
        
        if (contacts.length === 0) {
          return createToolResponse('No contacts found matching the criteria.');
        }

        const summary = `Found ${contacts.length} contact(s):`;
        
        return createDataResponse(summary, {
          total: result.total,
          contacts: contacts.map(contact => ({
            id: contact.id,
            name: contact.name,
            email: contact.email || 'N/A',
            phone: contact.phone || 'N/A',
            status: contact.status,
            type: contact.entityTypes.join(', '),
            createdAt: contact.createdAt,
          })),
        });
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get contact details
  server.registerTool(
    {
      name: 'get_contact',
      description: 'Get detailed information for a specific contact',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Contact ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const contact = await client.contacts.getById.query({ id: args.id });
        
        if (!contact) {
          return createToolResponse(`Contact with ID ${args.id} not found`, true);
        }
        
        return createDataResponse(
          `Contact details for ${contact.name}:`,
          {
            id: contact.id,
            name: contact.name,
            email: contact.email || 'N/A',
            phone: contact.phone || 'N/A',
            website: contact.website || 'N/A',
            status: contact.status,
            type: contact.entityTypes.join(', '),
            notes: contact.notes || 'N/A',
            metadata: contact.metadata || {},
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create contact
  server.registerTool(
    {
      name: 'create_contact',
      description: 'Create a new contact record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Contact name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          website: {
            type: 'string',
            description: 'Contact website',
          },
          notes: {
            type: 'string',
            description: 'Notes about the contact',
          },
        },
        required: ['name'],
      },
    },
    async (args: any, context: AuthContext) => {
      try {
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const contact: BaseEntity = await client.contacts.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          website: args.website,
          notes: args.notes,
          isActive: true,
        });
        
        return createDataResponse(
          `Successfully created contact: ${contact.name}`,
          {
            id: contact.id,
            name: contact.name,
            email: contact.email || 'N/A',
            phone: contact.phone || 'N/A',
            status: contact.status,
            createdAt: contact.createdAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update contact
  server.registerTool(
    {
      name: 'update_contact',
      description: 'Update an existing contact record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Contact ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Contact name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          website: {
            type: 'string',
            description: 'Contact website',
          },
          notes: {
            type: 'string',
            description: 'Notes about the contact',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Contact status',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
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
        
        const contact: BaseEntity = await client.contacts.update.mutate({
          id: args.id,
          data: updateData,
        });
        
        return createDataResponse(
          `Successfully updated contact: ${contact.name}`,
          {
            id: contact.id,
            name: contact.name,
            email: contact.email || 'N/A',
            phone: contact.phone || 'N/A',
            status: contact.status,
            updatedAt: contact.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  console.log('Contact tools registered successfully');
}