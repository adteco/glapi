/**
 * Sample Entity Tools for MCP Server
 * This demonstrates how to create tools for a typical CRUD entity
 */

import type { MCPServer } from '../mcp-server-core';
import type { AuthContext } from '../types';

// Example entity type
interface Entity {
  id?: string;
  organizationId: string;
  name: string;
  displayName?: string | null;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  status: 'active' | 'inactive' | 'archived';
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Helper function to create tRPC client
 */
function createBackendClient(apiUrl: string, context: AuthContext) {
  // This would be your actual tRPC client setup
  // Example implementation:
  return {
    entities: {
      list: {
        query: async (params: any) => {
          const response = await fetch(`${apiUrl}/api/trpc/entities.list`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.userId}`,
              'X-Organization-Id': context.organizationId,
            },
            body: JSON.stringify(params),
          });
          return response.json();
        },
      },
      get: {
        query: async (params: { id: string }) => {
          const response = await fetch(`${apiUrl}/api/trpc/entities.get`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.userId}`,
              'X-Organization-Id': context.organizationId,
            },
            body: JSON.stringify(params),
          });
          return response.json();
        },
      },
      create: {
        mutate: async (params: Partial<Entity>) => {
          const response = await fetch(`${apiUrl}/api/trpc/entities.create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.userId}`,
              'X-Organization-Id': context.organizationId,
            },
            body: JSON.stringify(params),
          });
          return response.json();
        },
      },
      update: {
        mutate: async (params: { id: string; data: Partial<Entity> }) => {
          const response = await fetch(`${apiUrl}/api/trpc/entities.update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.userId}`,
              'X-Organization-Id': context.organizationId,
            },
            body: JSON.stringify(params),
          });
          return response.json();
        },
      },
      delete: {
        mutate: async (params: { id: string }) => {
          const response = await fetch(`${apiUrl}/api/trpc/entities.delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${context.userId}`,
              'X-Organization-Id': context.organizationId,
            },
            body: JSON.stringify(params),
          });
          return response.json();
        },
      },
    },
  };
}

/**
 * Helper functions for responses
 */
function createToolResponse(content: string, isError: boolean = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: content,
      },
    ],
    isError,
  };
}

function createDataResponse(message: string, data: any, isError: boolean = false) {
  const dataText = typeof data === 'object' 
    ? JSON.stringify(data, null, 2)
    : String(data);
    
  return {
    content: [
      {
        type: 'text' as const,
        text: `${message}\n\n\`\`\`json\n${dataText}\n\`\`\``,
      },
    ],
    isError,
  };
}

/**
 * Check if user has required permission
 */
function checkPermission(context: AuthContext, permission: string): void {
  if (!context.permissions.includes(permission)) {
    throw new Error(`Insufficient permissions: ${permission} required`);
  }
}

/**
 * Register entity management tools
 */
export function registerEntityTools(server: MCPServer): void {
  // List entities
  server.registerTool(
    {
      name: 'list_entities',
      description: 'Retrieve and search entity records with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for entity name or email',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'all'],
            description: 'Filter by entity status',
            default: 'active',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of entities to return',
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
        
        const entities: Entity[] = await client.entities.list.query({
          includeInactive: args.status === 'all' || args.status === 'inactive',
        });
        
        // Filter entities based on search term if provided
        let filteredEntities = entities;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredEntities = entities.filter((entity: Entity) => 
            entity.name.toLowerCase().includes(searchLower) ||
            (entity.displayName && entity.displayName.toLowerCase().includes(searchLower)) ||
            (entity.email && entity.email.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply status filter
        if (args.status === 'active') {
          filteredEntities = filteredEntities.filter((e: Entity) => e.status === 'active');
        } else if (args.status === 'inactive') {
          filteredEntities = filteredEntities.filter((e: Entity) => e.status === 'inactive');
        }
        
        // Apply limit
        const limitedEntities = filteredEntities.slice(0, args.limit || 50);
        
        if (limitedEntities.length === 0) {
          return createToolResponse('No entities found matching the criteria.');
        }
        
        const summary = `Found ${limitedEntities.length} entity(ies):`;
        
        return createDataResponse(summary, {
          entities: limitedEntities.map((entity: Entity) => ({
            id: entity.id,
            name: entity.name,
            displayName: entity.displayName || entity.name,
            email: entity.email || 'N/A',
            phone: entity.phone || 'N/A',
            status: entity.status,
            code: entity.code,
            createdAt: entity.createdAt,
          })),
        });
        
      } catch (error) {
        console.error('[Entity Tool] List error:', error);
        return createToolResponse(
          `Failed to list entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );

  // Get entity by ID
  server.registerTool(
    {
      name: 'get_entity',
      description: 'Get detailed information for a specific entity',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Entity ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'entities:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const entity: Entity = await client.entities.get.query({ id: args.id });
        
        return createDataResponse(
          `Entity details for ${entity.displayName || entity.name}:`,
          {
            id: entity.id,
            name: entity.name,
            displayName: entity.displayName,
            code: entity.code,
            email: entity.email || 'N/A',
            phone: entity.phone || 'N/A',
            website: entity.website || 'N/A',
            status: entity.status,
            metadata: entity.metadata,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
          }
        );
        
      } catch (error) {
        console.error('[Entity Tool] Get error:', error);
        return createToolResponse(
          `Failed to get entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );

  // Create new entity
  server.registerTool(
    {
      name: 'create_entity',
      description: 'Create a new entity record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Entity name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the entity',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Entity email address',
          },
          phone: {
            type: 'string',
            description: 'Entity phone number',
          },
          website: {
            type: 'string',
            description: 'Entity website URL',
          },
          code: {
            type: 'string',
            description: 'Unique entity code',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata',
            additionalProperties: true,
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Entity Tool] Create entity called with:', args);
        
        checkPermission(context, 'entities:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        console.log('[Entity Tool] Calling tRPC to create entity...');
        const entity: Entity = await client.entities.create.mutate({
          organizationId: context.organizationId,
          name: args.name,
          displayName: args.displayName || undefined,
          email: args.email || undefined,
          phone: args.phone || undefined,
          website: args.website || undefined,
          code: args.code || undefined,
          status: 'active',
          isActive: true,
          metadata: args.metadata || {},
        });
        console.log('[Entity Tool] Entity created:', entity);
        
        return createDataResponse(
          `✅ Successfully created entity "${entity.displayName || entity.name}"`,
          {
            id: entity.id,
            name: entity.name,
            displayName: entity.displayName,
            email: entity.email || 'N/A',
            phone: entity.phone || 'N/A',
            website: entity.website || 'N/A',
            status: entity.status,
            code: entity.code,
            createdAt: entity.createdAt,
          }
        );
        
      } catch (error) {
        console.error('[Entity Tool] Create error:', error);
        return createToolResponse(
          `Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );

  // Update entity
  server.registerTool(
    {
      name: 'update_entity',
      description: 'Update an existing entity record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Entity ID (UUID)',
          },
          name: {
            type: 'string',
            description: 'Entity name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the entity',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Entity email address',
          },
          phone: {
            type: 'string',
            description: 'Entity phone number',
          },
          website: {
            type: 'string',
            description: 'Entity website URL',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Entity status',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata',
            additionalProperties: true,
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Entity Tool] Update entity called with:', args);
        
        checkPermission(context, 'entities:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Build update data - only include fields that were provided
        const updateData: any = {};
        if (args.name !== undefined) updateData.name = args.name;
        if (args.displayName !== undefined) updateData.displayName = args.displayName;
        if (args.email !== undefined) updateData.email = args.email;
        if (args.phone !== undefined) updateData.phone = args.phone;
        if (args.website !== undefined) updateData.website = args.website;
        if (args.status !== undefined) updateData.status = args.status;
        if (args.metadata !== undefined) updateData.metadata = args.metadata;
        
        console.log('[Entity Tool] Calling tRPC to update entity...');
        const entity: Entity = await client.entities.update.mutate({
          id: args.id,
          data: updateData,
        });
        console.log('[Entity Tool] Entity updated:', entity);
        
        return createDataResponse(
          `✅ Successfully updated entity "${entity.displayName || entity.name}"`,
          {
            id: entity.id,
            name: entity.name,
            displayName: entity.displayName,
            email: entity.email || 'N/A',
            phone: entity.phone || 'N/A',
            website: entity.website || 'N/A',
            status: entity.status,
            code: entity.code,
            updatedAt: entity.updatedAt,
          }
        );
        
      } catch (error) {
        console.error('[Entity Tool] Update error:', error);
        return createToolResponse(
          `Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );

  // Delete entity
  server.registerTool(
    {
      name: 'delete_entity',
      description: 'Delete an entity record',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Entity ID (UUID)',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Entity Tool] Delete entity called with:', args);
        
        checkPermission(context, 'entities:delete');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get entity name before deletion for confirmation
        const entity: Entity = await client.entities.get.query({ id: args.id });
        const entityName = entity.displayName || entity.name;
        
        console.log('[Entity Tool] Calling tRPC to delete entity...');
        await client.entities.delete.mutate({ id: args.id });
        console.log('[Entity Tool] Entity deleted');
        
        return createToolResponse(
          `✅ Successfully deleted entity "${entityName}"`
        );
        
      } catch (error) {
        console.error('[Entity Tool] Delete error:', error);
        return createToolResponse(
          `Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );
}