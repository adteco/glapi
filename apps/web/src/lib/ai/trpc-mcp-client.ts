/**
 * GLAPI TRPC-based MCP Client
 *
 * This module provides a real MCP client implementation that makes HTTP calls
 * to the TRPC API to execute database operations. It maps AI tool calls to
 * actual TRPC router methods.
 */

import { type MCPClient } from './action-executor';

// ============================================================================
// Types
// ============================================================================

export interface TRPCMCPClientConfig {
  /** The organization ID for the current user */
  organizationId: string;
  /** The user ID for the current user */
  userId: string;
  /** Base URL for TRPC API (defaults to /api/trpc) */
  baseUrl?: string;
  /** Enable logging */
  enableLogging?: boolean;
}

// ============================================================================
// TRPC HTTP Client
// ============================================================================

/**
 * Create a TRPC-based MCP client that uses HTTP calls
 *
 * This client translates AI tool calls into HTTP requests to the TRPC API.
 * This avoids importing server-side dependencies in the browser.
 */
export function createTRPCMCPClient(config: TRPCMCPClientConfig): MCPClient {
  const {
    organizationId,
    userId,
    baseUrl = '/api/trpc',
    enableLogging = false,
  } = config;

  /**
   * Make a TRPC query call
   */
  async function trpcQuery(procedure: string, input: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${baseUrl}/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;

    if (enableLogging) {
      console.log(`[TRPC MCP] Query: ${procedure}`, input);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include auth cookies
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TRPC query failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.result?.data;
  }

  /**
   * Make a TRPC mutation call
   */
  async function trpcMutation(procedure: string, input: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${baseUrl}/${procedure}`;

    if (enableLogging) {
      console.log(`[TRPC MCP] Mutation: ${procedure}`, input);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include auth cookies
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TRPC mutation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.result?.data;
  }

  /**
   * Execute a tool call
   */
  async function callTool(
    toolName: string,
    parameters: Record<string, unknown>,
    _authToken: string
  ): Promise<unknown> {
    if (enableLogging) {
      console.log(`[TRPC MCP] Calling tool: ${toolName}`, parameters);
    }

    try {
      // Map tool names to TRPC router calls
      switch (toolName) {
        // ============================================
        // Customer Operations
        // ============================================
        case 'list_customers': {
          const result = await trpcQuery('customers.list', {
            search: parameters.search,
            limit: parameters.limit || 50,
          });
          const customers = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { customers, total: (customers as unknown[]).length };
        }

        case 'get_customer': {
          const result = await trpcQuery('customers.getById', {
            id: parameters.id,
          });
          return { customer: result };
        }

        case 'create_customer': {
          const result = await trpcMutation('customers.create', {
            name: parameters.name,
            email: parameters.email,
            phone: parameters.phone,
          });
          return { customer: result, success: true };
        }

        case 'update_customer': {
          const result = await trpcMutation('customers.update', {
            id: parameters.id,
            name: parameters.name,
            email: parameters.email,
            phone: parameters.phone,
            isActive: parameters.status === 'active',
          });
          return { customer: result, success: true };
        }

        // ============================================
        // Vendor Operations
        // ============================================
        case 'list_vendors': {
          const result = await trpcQuery('vendors.list', {
            search: parameters.search,
            limit: parameters.limit || 50,
          });
          const vendors = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { vendors, total: (vendors as unknown[]).length };
        }

        case 'create_vendor': {
          const result = await trpcMutation('vendors.create', {
            name: parameters.name,
            email: parameters.email,
            phone: parameters.phone,
          });
          return { vendor: result, success: true };
        }

        // ============================================
        // Employee Operations
        // ============================================
        case 'list_employees': {
          const result = await trpcQuery('employees.list', {
            search: parameters.search,
          });
          const employees = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { employees, total: (employees as unknown[]).length };
        }

        case 'create_employee': {
          const nameParts = (parameters.name as string).split(' ');
          const result = await trpcMutation('employees.create', {
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: parameters.email,
            phone: parameters.phone,
          });
          return { employee: result, success: true };
        }

        // ============================================
        // Lead Operations
        // ============================================
        case 'list_leads': {
          const result = await trpcQuery('leads.list', {
            search: parameters.search,
          });
          const leads = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { leads, total: (leads as unknown[]).length };
        }

        case 'create_lead': {
          const result = await trpcMutation('leads.create', {
            name: parameters.name,
            email: parameters.email,
            phone: parameters.phone,
          });
          return { lead: result, success: true };
        }

        // ============================================
        // Prospect Operations
        // ============================================
        case 'list_prospects': {
          const result = await trpcQuery('prospects.list', {
            search: parameters.search,
          });
          const prospects = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { prospects, total: (prospects as unknown[]).length };
        }

        // ============================================
        // Contact Operations
        // ============================================
        case 'list_contacts': {
          const result = await trpcQuery('contacts.list', {
            search: parameters.search,
          });
          const contacts = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { contacts, total: (contacts as unknown[]).length };
        }

        // ============================================
        // Invoice Operations
        // ============================================
        case 'list_invoices': {
          const result = await trpcQuery('invoices.list', {
            customerId: parameters.customerId,
            status: parameters.status,
          });
          const invoices = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { invoices, total: (invoices as unknown[]).length };
        }

        case 'create_invoice': {
          return {
            success: false,
            error: 'Invoice creation via AI requires additional information. Please use the invoice form in the Transactions menu.',
          };
        }

        // ============================================
        // Project Operations
        // ============================================
        case 'list_projects': {
          const result = await trpcQuery('projects.list', {
            search: parameters.search,
            customerId: parameters.customerId,
          });
          const projects = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { projects, total: (projects as unknown[]).length };
        }

        // ============================================
        // Estimate Operations
        // ============================================
        case 'list_estimates': {
          const result = await trpcQuery('estimates.list', {
            search: parameters.search,
            customerId: parameters.customerId,
          });
          const estimates = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { estimates, total: (estimates as unknown[]).length };
        }

        // ============================================
        // Account Operations
        // ============================================
        case 'list_accounts': {
          const result = await trpcQuery('accounts.list', {
            search: parameters.search,
          });
          const accounts = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { accounts, total: (accounts as unknown[]).length };
        }

        // ============================================
        // Financial Reporting Operations
        // ============================================
        case 'generate_balance_sheet': {
          return {
            report: 'Balance Sheet',
            asOfDate: parameters.asOfDate || new Date().toISOString().split('T')[0],
            note: 'For full financial statements, please use the Reports section in the sidebar.',
            tip: 'Navigate to Reports > Financial Statements > Balance Sheet for a complete report.',
          };
        }

        case 'generate_income_statement': {
          return {
            report: 'Income Statement',
            startDate: parameters.startDate,
            endDate: parameters.endDate,
            note: 'For full financial statements, please use the Reports section in the sidebar.',
            tip: 'Navigate to Reports > Financial Statements > Income Statement for a complete report.',
          };
        }

        // ============================================
        // Journal Entry Operations
        // ============================================
        case 'create_journal_entry': {
          return {
            success: false,
            error: 'Journal entry creation via AI requires additional validation. Please use the journal entry form for proper debits/credits.',
            tip: 'Navigate to Transactions > Journal Entries to create a new entry.',
          };
        }

        // ============================================
        // Global Search
        // ============================================
        case 'global_search': {
          try {
            const result = await trpcQuery('globalSearch.search', {
              query: parameters.query,
              limit: parameters.limit || 20,
            });
            return { results: result, total: Array.isArray(result) ? result.length : 0 };
          } catch {
            return { results: [], total: 0, note: 'Search is currently unavailable.' };
          }
        }

        // ============================================
        // Help Operations
        // ============================================
        case 'help': {
          return {
            capabilities: [
              '📋 **Relationship Management**: List and search customers, vendors, employees, leads, prospects, and contacts',
              '🔍 **Search & View**: View customer and vendor details, find specific records',
              '➕ **Create Records**: Create new customers, vendors, leads (with confirmation)',
              '📊 **Projects & Jobs**: List projects, estimates, and invoices',
              '💰 **Financial Data**: View accounts and transaction information',
              '❓ **Help & Guidance**: Explain accounting concepts and system features',
            ],
            examples: [
              '"List all customers" - See your customer list',
              '"Find customers named Acme" - Search for specific customers',
              '"Show me open invoices" - View unpaid invoices',
              '"What projects are in progress?" - List active projects',
              '"Explain revenue recognition" - Get accounting help',
            ],
            tip: 'I can access your actual data in GLAPI. Try asking about your customers, vendors, or invoices!',
          };
        }

        case 'explain_concept': {
          // This will be handled by the LLM using its knowledge
          return {
            concept: parameters.concept,
            explanation: `I'll explain ${parameters.concept} for you based on my knowledge of accounting and business practices.`,
          };
        }

        // ============================================
        // Default Handler
        // ============================================
        default:
          if (enableLogging) {
            console.warn(`[TRPC MCP] Unknown tool: ${toolName}`);
          }
          return {
            success: false,
            error: `I don't recognize that action: ${toolName}. Try asking me to list customers, vendors, invoices, or projects.`,
            availableActions: ['list_customers', 'list_vendors', 'list_invoices', 'list_projects', 'list_employees', 'help'],
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (enableLogging) {
        console.error(`[TRPC MCP] Error executing ${toolName}:`, errorMessage);
      }
      throw new Error(`Failed to execute ${toolName}: ${errorMessage}`);
    }
  }

  return {
    callTool,
  };
}
