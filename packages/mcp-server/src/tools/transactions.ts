import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { createBackendClient, handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse, formatCurrency } from './index';
import { checkPermission } from '../mcp/auth';

/**
 * Register transaction processing tools
 */
export function registerTransactionTools(server: MCPServer): void {
  // Create estimate
  server.registerTool(
    {
      name: 'create_estimate',
      description: 'Create an estimate or quote for a customer',
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
            description: 'Estimate line items',
            minItems: 1,
          },
          validUntil: {
            type: 'string',
            format: 'date',
            description: 'Estimate expiration date (YYYY-MM-DD)',
          },
        },
        required: ['customerId', 'items'],
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'estimates:create');
        
        const client = createBackendClient(process.env.GLAPI_API_URL!, context);
        
        const lineItems = args.items.map((item: any) => ({
          ...item,
          total: item.quantity * item.unitPrice,
        }));
        
        const total = lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
        
        const estimate: any = await client.createTransaction({
          type: 'ESTIMATE',
          customerId: args.customerId,
          validUntil: args.validUntil,
          items: lineItems,
          total,
        });
        
        return createDataResponse(
          `✅ Successfully created estimate ${estimate.number}`,
          {
            id: estimate.id,
            number: estimate.number,
            customerId: args.customerId,
            total: formatCurrency(total),
            validUntil: args.validUntil,
            status: estimate.status,
            createdAt: estimate.createdAt,
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}