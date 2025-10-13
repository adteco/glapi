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

// Type for vendor from the API (BaseEntity)
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

export function registerVendorTools(server: MCPServer): void {
  // List vendors
  server.registerTool(
    {
      name: 'list_vendors',
      description: 'Retrieve and search vendor records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for vendor name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by vendor status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of vendors to return',
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
        
        const result: EntityListResponse = await client.vendors.list.query({
          search: args.search,
          isActive: args.status === 'all' ? undefined : args.status === 'active',
          limit: args.limit || 50,
          page: 1,
        });

        const vendors = result.data;
        
        if (vendors.length === 0) {
          return createToolResponse('No vendors found matching the criteria.');
        }

        const summary = `Found ${vendors.length} vendor(s):`;
        
        return createDataResponse(summary, {
          total: result.total,
          vendors: vendors.map(vendor => ({
            id: vendor.id,
            name: vendor.name,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            status: vendor.status,
            type: vendor.entityTypes.join(', '),
            metadata: vendor.metadata || {},
            createdAt: vendor.createdAt,
          })),
        });
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get vendor details
  server.registerTool(
    {
      name: 'get_vendor',
      description: 'Get detailed information for a specific vendor',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Vendor ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const vendor = await client.vendors.getById.query({ id: args.id });
        
        if (!vendor) {
          return createToolResponse(`Vendor with ID ${args.id} not found`, true);
        }
        
        return createDataResponse(
          `Vendor details for ${vendor.name}:`,
          {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            website: vendor.website || 'N/A',
            status: vendor.status,
            type: vendor.entityTypes.join(', '),
            taxId: vendor.taxId || 'N/A',
            metadata: vendor.metadata || {},
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create vendor
  server.registerTool(
    {
      name: 'create_vendor',
      description: 'Create a new vendor record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Vendor company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Vendor email address',
          },
          phone: {
            type: 'string',
            description: 'Vendor phone number',
          },
          website: {
            type: 'string',
            description: 'Vendor website',
          },
          taxId: {
            type: 'string',
            description: 'Tax ID / EIN',
          },
          paymentTerms: {
            type: 'string',
            description: 'Payment terms (e.g., Net 30)',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const vendor: BaseEntity = await client.vendors.create.mutate({
          name: args.name,
          email: args.email,
          phone: args.phone,
          website: args.website,
          taxIdNumber: args.taxId,
          isActive: true,
          metadata: {
            terms: args.paymentTerms,
          },
        });
        
        return createDataResponse(
          `Successfully created vendor: ${vendor.name}`,
          {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            status: vendor.status,
            metadata: vendor.metadata || {},
            createdAt: vendor.createdAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Update vendor
  server.registerTool(
    {
      name: 'update_vendor',
      description: 'Update an existing vendor record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Vendor ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Vendor company name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Vendor email address',
          },
          phone: {
            type: 'string',
            description: 'Vendor phone number',
          },
          website: {
            type: 'string',
            description: 'Vendor website',
          },
          taxId: {
            type: 'string',
            description: 'Tax ID / EIN',
          },
          paymentTerms: {
            type: 'string',
            description: 'Payment terms (e.g., Net 30)',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Vendor status',
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
        if (args.taxId !== undefined) updateData.taxId = args.taxId;
        if (args.status !== undefined) {
          updateData.status = args.status;
          updateData.isActive = args.status === 'active';
        }
        
        // Handle metadata updates
        if (args.paymentTerms !== undefined) {
          updateData.metadata = {
            terms: args.paymentTerms,
          };
        }
        
        const vendor: BaseEntity = await client.vendors.update.mutate({
          id: args.id,
          data: updateData,
        });
        
        return createDataResponse(
          `Successfully updated vendor: ${vendor.name}`,
          {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            status: vendor.status,
            metadata: vendor.metadata || {},
            updatedAt: vendor.updatedAt,
          }
        );
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  console.log('Vendor tools registered successfully');
}