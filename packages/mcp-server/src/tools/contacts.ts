import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for contact from the API
interface Contact {
  id?: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  entityId?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  parentEntityId?: string | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    company?: string;
    department?: string;
    contact_type?: string;
    preferred_communication?: string;
    mobilePhone?: string;
    workPhone?: string;
  } | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register contact management tools
 */
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
          isActive: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          companyId: {
            type: 'string',
            description: 'Filter by company ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of contacts to return',
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
      if (!checkPermission(context, 'read', 'contacts')) {
        return createToolResponse('Permission denied: cannot read contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const result = await client.contacts.list.query({
          search: args.search,
          isActive: args.isActive,
          limit: args.limit || 50,
          page: args.page || 1,
        });

        return createDataResponse(
          `Found ${result.total} contacts (showing ${result.data.length})`,
          result
        );
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Get single contact
  server.registerTool(
    {
      name: 'get_contact',
      description: 'Retrieve a single contact by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The contact ID',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'read', 'contacts')) {
        return createToolResponse('Permission denied: cannot read contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const contact = await client.contacts.getById.query({ id: args.id });

        if (!contact) {
          return createToolResponse('Contact not found', true);
        }

        return createDataResponse('Contact retrieved successfully', contact);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
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
            description: 'Full name of the contact',
          },
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
          metadata: {
            type: 'object',
            properties: {
              first_name: {
                type: 'string',
                description: 'First name',
              },
              last_name: {
                type: 'string',
                description: 'Last name',
              },
              title: {
                type: 'string',
                description: 'Job title',
              },
              company: {
                type: 'string',
                description: 'Company ID this contact belongs to',
              },
              department: {
                type: 'string',
                description: 'Department',
              },
              mobilePhone: {
                type: 'string',
                description: 'Mobile phone number',
              },
              workPhone: {
                type: 'string',
                description: 'Work phone number',
              },
              preferred_communication: {
                type: 'string',
                enum: ['email', 'phone', 'mobile'],
                description: 'Preferred communication method',
              },
            },
          },
        },
        required: ['name'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'contacts')) {
        return createToolResponse('Permission denied: cannot create contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const contact = await client.contacts.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          notes: args.notes,
          isActive: true,
          metadata: args.metadata,
        });

        return createDataResponse('Contact created successfully', contact);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
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
            description: 'The contact ID to update',
          },
          name: {
            type: 'string',
            description: 'Full name of the contact',
          },
          email: {
            type: 'string',
            description: 'Contact email address',
          },
          phone: {
            type: 'string',
            description: 'Contact phone number',
          },
          notes: {
            type: 'string',
            description: 'Additional notes',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the contact is active',
          },
          metadata: {
            type: 'object',
            properties: {
              first_name: {
                type: 'string',
                description: 'First name',
              },
              last_name: {
                type: 'string',
                description: 'Last name',
              },
              title: {
                type: 'string',
                description: 'Job title',
              },
              company: {
                type: 'string',
                description: 'Company ID this contact belongs to',
              },
              department: {
                type: 'string',
                description: 'Department',
              },
              mobilePhone: {
                type: 'string',
                description: 'Mobile phone number',
              },
              workPhone: {
                type: 'string',
                description: 'Work phone number',
              },
              preferred_communication: {
                type: 'string',
                enum: ['email', 'phone', 'mobile'],
                description: 'Preferred communication method',
              },
              contact_type: {
                type: 'string',
                description: 'Type of contact',
              },
            },
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'contacts')) {
        return createToolResponse('Permission denied: cannot update contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const { id, ...data } = args;
        const contact = await client.contacts.update.mutate({
          id,
          data,
        });

        return createDataResponse('Contact updated successfully', contact);
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Delete contact
  server.registerTool(
    {
      name: 'delete_contact',
      description: 'Delete a contact record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The contact ID to delete',
          },
        },
        required: ['id'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'write', 'contacts')) {
        return createToolResponse('Permission denied: cannot delete contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        await client.contacts.delete.mutate({ id: args.id });

        return createToolResponse('Contact deleted successfully');
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Get contacts by company
  server.registerTool(
    {
      name: 'get_contacts_by_company',
      description: 'Get all contacts associated with a specific company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            description: 'The company ID to find contacts for',
          },
        },
        required: ['companyId'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'read', 'contacts')) {
        return createToolResponse('Permission denied: cannot read contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const result = await client.contacts.list.query({
          limit: 100,
          page: 1,
        });

        // Filter contacts by company ID in metadata
        const companyContacts = result.data.filter(
          contact => contact.metadata?.company === args.companyId || contact.parentEntityId === args.companyId
        );

        return createDataResponse(
          `Found ${companyContacts.length} contacts for the company`,
          companyContacts
        );
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );

  // Search contacts
  server.registerTool(
    {
      name: 'search_contacts',
      description: 'Search contacts by name, email, or company',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
          },
          filters: {
            type: 'object',
            properties: {
              companyId: {
                type: 'string',
                description: 'Filter by company ID',
              },
              title: {
                type: 'string',
                description: 'Filter by job title',
              },
              department: {
                type: 'string',
                description: 'Filter by department',
              },
              contactType: {
                type: 'string',
                description: 'Filter by contact type',
              },
            },
          },
        },
        required: ['query'],
      },
    },
    async (args: any, context: AuthContext) => {
      if (!checkPermission(context, 'read', 'contacts')) {
        return createToolResponse('Permission denied: cannot search contacts', true);
      }

      try {
        const client = await createBackendClient(context);
        const result = await client.contacts.list.query({
          search: args.query,
          limit: 100,
          page: 1,
        });

        let filteredContacts = result.data;

        // Apply additional filters if provided
        if (args.filters) {
          if (args.filters.companyId) {
            filteredContacts = filteredContacts.filter(
              contact => contact.metadata?.company === args.filters.companyId || contact.parentEntityId === args.filters.companyId
            );
          }
          if (args.filters.title) {
            filteredContacts = filteredContacts.filter(
              contact => contact.metadata?.title?.toLowerCase().includes(args.filters.title.toLowerCase())
            );
          }
          if (args.filters.department) {
            filteredContacts = filteredContacts.filter(
              contact => contact.metadata?.department?.toLowerCase().includes(args.filters.department.toLowerCase())
            );
          }
          if (args.filters.contactType) {
            filteredContacts = filteredContacts.filter(
              contact => contact.metadata?.contact_type === args.filters.contactType
            );
          }
        }

        return createDataResponse(
          `Found ${filteredContacts.length} contacts matching "${args.query}"`,
          filteredContacts
        );
      } catch (error) {
        return createToolResponse(handleAPIError(error), true);
      }
    }
  );
}