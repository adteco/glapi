import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for vendor from the API
interface Vendor {
  id?: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: any;
  taxId?: string | null;
  description?: string | null;
  notes?: string | null;
  metadata?: any;
  status: 'active' | 'inactive' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register vendor management tools
 */
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
        checkPermission(context, 'vendors:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const vendors: Vendor[] = await client.vendors.list.query({
          includeInactive: args.status === 'all' || args.status === 'inactive',
        });
        
        // Filter vendors based on search term if provided
        let filteredVendors = vendors;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredVendors = vendors.filter((vendor: Vendor) => 
            vendor.name.toLowerCase().includes(searchLower) ||
            (vendor.displayName && vendor.displayName.toLowerCase().includes(searchLower)) ||
            (vendor.email && vendor.email.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply status filter
        if (args.status === 'active') {
          filteredVendors = filteredVendors.filter((v: Vendor) => v.status === 'active');
        } else if (args.status === 'inactive') {
          filteredVendors = filteredVendors.filter((v: Vendor) => v.status === 'inactive');
        }
        
        // Apply limit
        const limitedVendors = filteredVendors.slice(0, args.limit || 50);
        
        if (limitedVendors.length === 0) {
          return createToolResponse('No vendors found matching the criteria.');
        }
        
        const summary = `Found ${limitedVendors.length} vendor(s):`;
        
        return createDataResponse(summary, {
          vendors: limitedVendors.map((vendor: Vendor) => ({
            id: vendor.id,
            name: vendor.name,
            displayName: vendor.displayName || vendor.name,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            status: vendor.status,
            code: vendor.code,
            createdAt: vendor.createdAt,
          })),
        });
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get vendor by ID
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
        checkPermission(context, 'vendors:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const vendor: Vendor = await client.vendors.get.query({ id: args.id });
        
        return createDataResponse(
          `Vendor details for ${vendor.displayName || vendor.name}:`,
          {
            id: vendor.id,
            name: vendor.name,
            displayName: vendor.displayName,
            code: vendor.code,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            website: vendor.website || 'N/A',
            status: vendor.status,
            taxId: vendor.taxId,
            address: vendor.address,
            description: vendor.description,
            notes: vendor.notes,
            metadata: vendor.metadata,
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create new vendor
  server.registerTool(
    {
      name: 'create_vendor',
      description: 'Create a new vendor record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Vendor name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the vendor',
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
            description: 'Vendor website URL',
          },
          taxId: {
            type: 'string',
            description: 'Tax identification number',
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Vendors Tool] Create vendor called with:', args);
        
        checkPermission(context, 'vendors:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        console.log('[Vendors Tool] Calling tRPC to create vendor...');
        const vendor: Vendor = await client.vendors.create.mutate({
          organizationId: context.organizationId,
          name: args.name,
          displayName: args.displayName || undefined,
          email: args.email || undefined,
          phone: args.phone || undefined,
          website: args.website || undefined,
          taxId: args.taxId || undefined,
          status: 'active',
        });
        console.log('[Vendors Tool] Vendor created:', vendor);
        
        return createDataResponse(
          `✅ Successfully created vendor "${vendor.displayName || vendor.name}"`,
          {
            id: vendor.id,
            name: vendor.name,
            displayName: vendor.displayName,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            website: vendor.website || 'N/A',
            status: vendor.status,
            code: vendor.code,
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
            description: 'Vendor name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the vendor',
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
            description: 'Vendor website URL',
          },
          taxId: {
            type: 'string',
            description: 'Tax identification number',
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
        console.log('[Vendors Tool] Update vendor called with:', args);
        
        checkPermission(context, 'vendors:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Build update data - only include fields that were provided
        const updateData: any = {};
        if (args.name !== undefined) updateData.name = args.name;
        if (args.displayName !== undefined) updateData.displayName = args.displayName;
        if (args.email !== undefined) updateData.email = args.email;
        if (args.phone !== undefined) updateData.phone = args.phone;
        if (args.website !== undefined) updateData.website = args.website;
        if (args.taxId !== undefined) updateData.taxId = args.taxId;
        if (args.status !== undefined) updateData.status = args.status;
        
        console.log('[Vendors Tool] Calling tRPC to update vendor...');
        const vendor: Vendor = await client.vendors.update.mutate({
          id: args.id,
          data: updateData,
        });
        console.log('[Vendors Tool] Vendor updated:', vendor);
        
        return createDataResponse(
          `✅ Successfully updated vendor "${vendor.displayName || vendor.name}"`,
          {
            id: vendor.id,
            name: vendor.name,
            displayName: vendor.displayName,
            email: vendor.email || 'N/A',
            phone: vendor.phone || 'N/A',
            website: vendor.website || 'N/A',
            status: vendor.status,
            code: vendor.code,
            updatedAt: vendor.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Delete vendor
  server.registerTool(
    {
      name: 'delete_vendor',
      description: 'Delete a vendor record',
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
        console.log('[Vendors Tool] Delete vendor called with:', args);
        
        checkPermission(context, 'vendors:delete');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get vendor name before deletion for confirmation
        const vendor: Vendor = await client.vendors.get.query({ id: args.id });
        const vendorName = vendor.displayName || vendor.name;
        
        console.log('[Vendors Tool] Calling tRPC to delete vendor...');
        await client.vendors.delete.mutate({ id: args.id });
        console.log('[Vendors Tool] Vendor deleted');
        
        return createToolResponse(
          `✅ Successfully deleted vendor "${vendorName}"`
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}