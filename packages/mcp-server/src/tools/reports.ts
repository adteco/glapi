import type { MCPServer } from '../mcp/server';
import type { AuthContext } from '../mcp/types';
import { handleAPIError } from '../services/trpc-client';
import { createToolResponse, createDataResponse, formatCurrency } from './index';
import { checkPermission } from '../mcp/auth';

/**
 * Register reporting and analytics tools
 */
export function registerReportTools(server: MCPServer): void {
  // Financial summary
  server.registerTool(
    {
      name: 'financial_summary',
      description: 'Get high-level financial metrics and summary',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['this_month', 'last_month', 'this_year'],
            description: 'Predefined period for the report',
            default: 'this_month',
          },
        },
      },
    },
    async (args, context) => {
      try {
        checkPermission(context, 'reports:read');
        
        // For now, return mock data
        // TODO: Integrate with actual reporting API
        
        return createDataResponse(
          `Financial Summary for ${args.period || 'this_month'}:`,
          {
            revenue: {
              total: formatCurrency(125000),
              invoiced: formatCurrency(100000),
              paid: formatCurrency(85000),
            },
            expenses: {
              total: formatCurrency(75000),
              paid: formatCurrency(70000),
            },
            profit: {
              gross: formatCurrency(50000),
              net: formatCurrency(40000),
            },
          }
        );
        
      } catch (error) {
        handleAPIError(error);
      }
    }
  );
}