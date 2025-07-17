import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse } from './index';
import { checkPermission } from '../mcp/auth';

// Type for lead from the API
interface Lead {
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
  metadata?: {
    source?: string;
    industry?: string;
    annualRevenue?: number;
    numberOfEmployees?: number;
    leadScore?: number;
    assignedTo?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Register lead management tools
 */
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
            enum: ['active', 'inactive', 'archived', 'all'],
            description: 'Filter by lead status',
            default: 'active',
          },
          minScore: {
            type: 'number',
            description: 'Minimum lead score (0-100)',
            minimum: 0,
            maximum: 100,
          },
          source: {
            type: 'string',
            description: 'Filter by lead source',
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
        checkPermission(context, 'leads:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const leads: Lead[] = await client.leads.list.query({});
        
        // Filter leads based on search term if provided
        let filteredLeads = leads;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredLeads = leads.filter((lead: Lead) => 
            lead.name.toLowerCase().includes(searchLower) ||
            (lead.displayName && lead.displayName.toLowerCase().includes(searchLower)) ||
            (lead.email && lead.email.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply status filter
        if (args.status !== 'all') {
          filteredLeads = filteredLeads.filter((l: Lead) => l.status === args.status);
        }
        
        // Apply score filter
        if (args.minScore !== undefined) {
          filteredLeads = filteredLeads.filter((l: Lead) => 
            (l.metadata?.leadScore || 0) >= args.minScore
          );
        }
        
        // Apply source filter
        if (args.source) {
          filteredLeads = filteredLeads.filter((l: Lead) => 
            l.metadata?.source?.toLowerCase() === args.source.toLowerCase()
          );
        }
        
        // Sort by lead score (highest first)
        filteredLeads.sort((a, b) => 
          (b.metadata?.leadScore || 0) - (a.metadata?.leadScore || 0)
        );
        
        // Apply limit
        const limitedLeads = filteredLeads.slice(0, args.limit || 50);
        
        if (limitedLeads.length === 0) {
          return createToolResponse('No leads found matching the criteria.');
        }
        
        const summary = `Found ${limitedLeads.length} lead(s):`;
        
        return createDataResponse(summary, {
          leads: limitedLeads.map((lead: Lead) => ({
            id: lead.id,
            name: lead.name,
            displayName: lead.displayName || lead.name,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            status: lead.status,
            leadScore: lead.metadata?.leadScore || 0,
            source: lead.metadata?.source || 'N/A',
            industry: lead.metadata?.industry || 'N/A',
            annualRevenue: lead.metadata?.annualRevenue,
            createdAt: lead.createdAt,
          })),
        });
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Get lead by ID
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
        checkPermission(context, 'leads:read');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        const lead: Lead = await client.leads.get.query({ id: args.id });
        
        return createDataResponse(
          `Lead details for ${lead.displayName || lead.name}:`,
          {
            id: lead.id,
            name: lead.name,
            displayName: lead.displayName,
            code: lead.code,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            website: lead.website || 'N/A',
            status: lead.status,
            metadata: lead.metadata,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Create new lead
  server.registerTool(
    {
      name: 'create_lead',
      description: 'Create a new lead record',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Lead company name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the lead',
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
            description: 'Lead website URL',
          },
          source: {
            type: 'string',
            description: 'Lead source (e.g., Website, Referral, Trade Show)',
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
          leadScore: {
            type: 'number',
            description: 'Lead score (0-100)',
            minimum: 0,
            maximum: 100,
          },
        },
        required: ['name'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Leads Tool] Create lead called with:', args);
        
        checkPermission(context, 'leads:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        console.log('[Leads Tool] Calling tRPC to create lead...');
        const lead: Lead = await client.leads.create.mutate({
          organizationId: context.organizationId,
          name: args.name,
          displayName: args.displayName || undefined,
          email: args.email || undefined,
          phone: args.phone || undefined,
          website: args.website || undefined,
          status: 'active',
          isActive: true,
          metadata: {
            source: args.source || undefined,
            industry: args.industry || undefined,
            annualRevenue: args.annualRevenue || undefined,
            numberOfEmployees: args.numberOfEmployees || undefined,
            leadScore: args.leadScore || 50,
          },
        });
        console.log('[Leads Tool] Lead created:', lead);
        
        return createDataResponse(
          `✅ Successfully created lead "${lead.displayName || lead.name}"`,
          {
            id: lead.id,
            name: lead.name,
            displayName: lead.displayName,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            website: lead.website || 'N/A',
            status: lead.status,
            leadScore: lead.metadata?.leadScore || 50,
            source: lead.metadata?.source || 'N/A',
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
            description: 'Lead company name',
          },
          displayName: {
            type: 'string',
            description: 'Display name for the lead',
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
            description: 'Lead website URL',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived'],
            description: 'Lead status',
          },
          source: {
            type: 'string',
            description: 'Lead source',
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
          leadScore: {
            type: 'number',
            description: 'Lead score (0-100)',
            minimum: 0,
            maximum: 100,
          },
          assignedTo: {
            type: 'string',
            description: 'Assigned sales representative',
          },
        },
        required: ['id'],
      },
    },
    async (args, context) => {
      try {
        console.log('[Leads Tool] Update lead called with:', args);
        
        checkPermission(context, 'leads:update');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Build update data - only include fields that were provided
        const updateData: any = {
          data: {}
        };
        if (args.name !== undefined) updateData.data.name = args.name;
        if (args.displayName !== undefined) updateData.data.displayName = args.displayName;
        if (args.email !== undefined) updateData.data.email = args.email;
        if (args.phone !== undefined) updateData.data.phone = args.phone;
        if (args.website !== undefined) updateData.data.website = args.website;
        if (args.status !== undefined) updateData.data.status = args.status;
        
        // Build metadata
        const metadata: any = {};
        if (args.source !== undefined) metadata.source = args.source;
        if (args.industry !== undefined) metadata.industry = args.industry;
        if (args.annualRevenue !== undefined) metadata.annualRevenue = args.annualRevenue;
        if (args.numberOfEmployees !== undefined) metadata.numberOfEmployees = args.numberOfEmployees;
        if (args.leadScore !== undefined) metadata.leadScore = args.leadScore;
        if (args.assignedTo !== undefined) metadata.assignedTo = args.assignedTo;
        
        if (Object.keys(metadata).length > 0) {
          updateData.data.metadata = metadata;
        }
        
        console.log('[Leads Tool] Calling tRPC to update lead...');
        const lead: Lead = await client.leads.update.mutate({
          id: args.id,
          ...updateData,
        });
        console.log('[Leads Tool] Lead updated:', lead);
        
        return createDataResponse(
          `✅ Successfully updated lead "${lead.displayName || lead.name}"`,
          {
            id: lead.id,
            name: lead.name,
            displayName: lead.displayName,
            email: lead.email || 'N/A',
            phone: lead.phone || 'N/A',
            website: lead.website || 'N/A',
            status: lead.status,
            leadScore: lead.metadata?.leadScore || 0,
            updatedAt: lead.updatedAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // Delete lead
  server.registerTool(
    {
      name: 'delete_lead',
      description: 'Delete a lead record',
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
        console.log('[Leads Tool] Delete lead called with:', args);
        
        checkPermission(context, 'leads:delete');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get lead name before deletion for confirmation
        const lead: Lead = await client.leads.get.query({ id: args.id });
        const leadName = lead.displayName || lead.name;
        
        console.log('[Leads Tool] Calling tRPC to delete lead...');
        await client.leads.delete.mutate({ id: args.id });
        console.log('[Leads Tool] Lead deleted');
        
        return createToolResponse(
          `✅ Successfully deleted lead "${leadName}"`
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
        console.log('[Leads Tool] Convert lead to customer called with:', args);
        
        checkPermission(context, 'leads:update');
        checkPermission(context, 'customers:create');
        
        const client = createBackendClient(context.env.GLAPI_API_URL, context);
        
        // Get lead details first
        const lead: Lead = await client.leads.get.query({ id: args.id });
        
        console.log('[Leads Tool] Calling tRPC to convert lead to customer...');
        const result = await client.leads.convertToCustomer.mutate({ id: args.id });
        console.log('[Leads Tool] Lead converted to customer');
        
        return createDataResponse(
          `✅ Successfully converted lead "${lead.displayName || lead.name}" to customer`,
          {
            customerId: result.customerId,
            customerName: lead.name,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}