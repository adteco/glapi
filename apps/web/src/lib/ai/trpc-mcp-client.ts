/**
 * GLAPI TRPC-based MCP Client
 *
 * This module provides a real MCP client implementation that uses the TRPC
 * server-side caller to execute database operations directly. It maps AI
 * tool calls to actual TRPC router methods.
 */

import { type MCPClient } from './action-executor';
import { appRouter, createCallerFactory } from '@glapi/trpc';
import { createContextualDb } from '@glapi/database';
import type { OrganizationId, ClerkUserId, EntityId } from '@glapi/shared-types';

// ============================================================================
// Types
// ============================================================================

export interface TRPCMCPClientConfig {
  /** The organization ID for the current user */
  organizationId: string;
  /** The user ID for the current user */
  userId: string;
  /** Base URL for TRPC API (deprecated - not used with server caller) */
  baseUrl?: string;
  /** Enable logging */
  enableLogging?: boolean;
}

// ============================================================================
// TRPC Server Caller Client
// ============================================================================

/**
 * Create a TRPC-based MCP client that uses server-side caller
 *
 * This client translates AI tool calls into direct TRPC procedure calls
 * using the server-side caller. No HTTP requests needed.
 */
export function createTRPCMCPClient(config: TRPCMCPClientConfig): MCPClient {
  const {
    organizationId,
    userId,
    enableLogging = false,
  } = config;

  // Create the caller factory
  const createCaller = createCallerFactory(appRouter);

  /**
   * Get a caller with the proper context
   */
  async function getCaller() {
    const { db, release } = await createContextualDb({
      organizationId: organizationId as OrganizationId,
      userId
    });

    const caller = createCaller({
      req: undefined,
      res: undefined,
      resHeaders: undefined,
      organizationName: undefined,
      db,
      user: {
        id: userId,
        clerkId: userId as ClerkUserId,
        organizationId: organizationId as OrganizationId,
        entityId: null as EntityId | null,
        email: null,
        role: 'user' as const,
      },
      serviceContext: {
        organizationId: organizationId as OrganizationId,
        clerkUserId: userId as ClerkUserId,
        entityId: null as EntityId | null,
        userId,
      },
    });

    return { caller, release };
  }

  /**
   * Execute a TRPC query with proper context handling
   */
  async function trpcQuery<T>(
    queryFn: (caller: ReturnType<typeof createCaller>) => Promise<T>
  ): Promise<T> {
    const { caller, release } = await getCaller();
    try {
      return await queryFn(caller);
    } finally {
      release();
    }
  }

  /**
   * Execute a TRPC mutation with proper context handling
   */
  async function trpcMutation<T>(
    mutationFn: (caller: ReturnType<typeof createCaller>) => Promise<T>
  ): Promise<T> {
    const { caller, release } = await getCaller();
    try {
      return await mutationFn(caller);
    } finally {
      release();
    }
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
          const result = await trpcQuery(async (caller) =>
            caller.customers.list({
              includeInactive: parameters.includeInactive as boolean | undefined,
            })
          );
          const customers = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { customers, total: (customers as unknown[]).length };
        }

        case 'get_customer': {
          const result = await trpcQuery(async (caller) =>
            caller.customers.get({ id: parameters.id as string })
          );
          return { customer: result };
        }

        case 'create_customer': {
          const result = await trpcMutation(async (caller) =>
            caller.customers.create({
              companyName: parameters.name as string,
              contactEmail: parameters.email as string | undefined,
              contactPhone: parameters.phone as string | undefined,
            })
          );
          return { customer: result, success: true };
        }

        case 'update_customer': {
          const result = await trpcMutation(async (caller) =>
            caller.customers.update({
              id: parameters.id as string,
              data: {
                companyName: parameters.name as string | undefined,
                contactEmail: parameters.email as string | undefined,
                contactPhone: parameters.phone as string | undefined,
                status: parameters.status as 'active' | 'inactive' | 'archived' | undefined,
              },
            })
          );
          return { customer: result, success: true };
        }

        // ============================================
        // Vendor Operations
        // ============================================
        case 'list_vendors': {
          const result = await trpcQuery(async (caller) =>
            caller.vendors.list({
              search: parameters.search as string | undefined,
              limit: (parameters.limit as number) || 50,
            })
          );
          const vendors = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { vendors, total: (vendors as unknown[]).length };
        }

        case 'create_vendor': {
          const result = await trpcMutation(async (caller) =>
            caller.vendors.create({
              name: parameters.name as string,
              email: parameters.email as string | undefined,
              phone: parameters.phone as string | undefined,
            })
          );
          return { vendor: result, success: true };
        }

        // ============================================
        // Employee Operations
        // ============================================
        case 'list_employees': {
          const result = await trpcQuery(async (caller) =>
            caller.employees.list({
              search: parameters.search as string | undefined,
            })
          );
          const employees = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { employees, total: (employees as unknown[]).length };
        }

        case 'create_employee': {
          const result = await trpcMutation(async (caller) =>
            caller.employees.create({
              name: parameters.name as string,
              email: parameters.email as string | undefined,
              phone: parameters.phone as string | undefined,
            })
          );
          return { employee: result, success: true };
        }

        // ============================================
        // Lead Operations
        // ============================================
        case 'list_leads': {
          const result = await trpcQuery(async (caller) =>
            caller.leads.list({
              search: parameters.search as string | undefined,
            })
          );
          const leads = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { leads, total: (leads as unknown[]).length };
        }

        case 'create_lead': {
          const result = await trpcMutation(async (caller) =>
            caller.leads.create({
              name: parameters.name as string,
              email: parameters.email as string | undefined,
              phone: parameters.phone as string | undefined,
            })
          );
          return { lead: result, success: true };
        }

        // ============================================
        // Prospect Operations
        // ============================================
        case 'list_prospects': {
          const result = await trpcQuery(async (caller) =>
            caller.prospects.list({
              search: parameters.search as string | undefined,
            })
          );
          const prospects = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { prospects, total: (prospects as unknown[]).length };
        }

        // ============================================
        // Contact Operations
        // ============================================
        case 'list_contacts': {
          const result = await trpcQuery(async (caller) =>
            caller.contacts.list({
              search: parameters.search as string | undefined,
            })
          );
          const contacts = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { contacts, total: (contacts as unknown[]).length };
        }

        // ============================================
        // Invoice Operations
        // ============================================
        case 'list_invoices': {
          const result = await trpcQuery(async (caller) =>
            caller.invoices.list({
              entityId: parameters.customerId as string | undefined,
              status: parameters.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | undefined,
            })
          );
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
          const result = await trpcQuery(async (caller) =>
            caller.projects.list({
              filters: {
                search: parameters.search as string | undefined,
                customerId: parameters.customerId as string | undefined,
              },
            })
          );
          const projects = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { projects, total: (projects as unknown[]).length };
        }

        // ============================================
        // Estimate Operations
        // ============================================
        case 'list_estimates': {
          const result = await trpcQuery(async (caller) =>
            caller.estimates.list({
              filters: {
                search: parameters.search as string | undefined,
                entityId: parameters.customerId as string | undefined,
              },
            })
          );
          const estimates = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data || [];
          return { estimates, total: (estimates as unknown[]).length };
        }

        // ============================================
        // Account Operations
        // ============================================
        case 'list_accounts': {
          const result = await trpcQuery(async (caller) =>
            caller.accounts.list({})
          );
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
            const result = await trpcQuery(async (caller) =>
              caller.globalSearch.search({
                query: parameters.query as string,
                limit: (parameters.limit as number) || 20,
              })
            );
            return { results: result.results, total: result.results.length };
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
              'List and search customers, vendors, employees, leads, prospects, and contacts',
              'View customer and vendor details, find specific records',
              'Create new customers, vendors, leads (with confirmation)',
              'List projects, estimates, and invoices',
              'View accounts and transaction information',
              'Explain accounting concepts and system features',
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
