import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse, formatCurrency } from './index';
import { checkPermission } from '../mcp/auth';

/**
 * Register invoice management tools
 */
export function registerInvoiceTools(server: MCPServer): void {
  // Create invoice
  server.registerTool(
    {
      name: 'create_invoice',
      description: 'Create a new invoice for a customer',
      inputSchema: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Customer ID',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number', minimum: 0.01 },
                unitPrice: { type: 'number', minimum: 0 },
              },
              required: ['description', 'quantity', 'unitPrice'],
            },
            description: 'Invoice line items',
            minItems: 1,
          },
          dueDate: {
            type: 'string',
            format: 'date',
            description: 'Invoice due date (YYYY-MM-DD)',
          },
        },
        required: ['customerId', 'items'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'invoices:create');
        
        const client = createBackendClient(process.env.GLAPI_API_URL!, context);
        
        // Calculate totals
        const lineItems = args.items.map((item: any) => ({
          ...item,
          total: item.quantity * item.unitPrice,
        }));
        
        const total = lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
        
        // Create invoice
        const invoice: any = await client.createTransaction({
          type: 'INVOICE',
          customerId: args.customerId,
          dueDate: args.dueDate,
          items: lineItems,
          total,
        });
        
        return createDataResponse(
          `✅ Successfully created invoice ${invoice.number}`,
          {
            id: invoice.id,
            number: invoice.number,
            customerId: args.customerId,
            total: formatCurrency(total),
            dueDate: args.dueDate,
            status: invoice.status,
            createdAt: invoice.createdAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );

  // List invoices
  server.registerTool(
    {
      name: 'list_invoices',
      description: 'Retrieve invoices with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          customerId: {
            type: 'string',
            description: 'Filter by customer ID',
          },
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'paid', 'overdue'],
            description: 'Filter by invoice status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of invoices to return',
            default: 50,
          },
        },
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'invoices:read');
        
        const client = createBackendClient(process.env.GLAPI_API_URL!, context);
        
        const result: any = await client.listTransactions({
          type: 'INVOICE',
          customerId: args.customerId,
          status: args.status,
          limit: args.limit || 50,
        });
        
        if (!result.transactions || result.transactions.length === 0) {
          return createToolResponse('No invoices found matching the criteria.');
        }
        
        const summary = `Found ${result.transactions.length} invoice(s):`;
        
        return createDataResponse(summary, {
          invoices: result.transactions.map((invoice: any) => ({
            id: invoice.id,
            number: invoice.number,
            customerId: invoice.customerId,
            amount: formatCurrency(invoice.total),
            status: invoice.status,
            dueDate: invoice.dueDate,
            createdAt: invoice.createdAt,
          })),
        });
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}