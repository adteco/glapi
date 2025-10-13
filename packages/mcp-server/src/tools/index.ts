import type { MCPServer } from '../mcp/server';
import { registerCustomerTools } from './customers';
import { registerVendorTools } from './vendors';
import { registerEmployeeTools } from './employees';
import { registerLeadTools } from './leads';
import { registerProspectTools } from './prospects';
import { registerContactTools } from './contacts';
// import { registerInvoiceTools } from './invoices';
// import { registerTransactionTools } from './transactions';
// import { registerReportTools } from './reports';

/**
 * Register all available tools with the MCP server
 */
export function registerAllTools(server: MCPServer): void {
  // Customer management tools
  registerCustomerTools(server);
  
  // Vendor management tools
  registerVendorTools(server);
  
  // Employee management tools
  registerEmployeeTools(server);
  
  // Lead management tools
  registerLeadTools(server);
  
  // Prospect management tools
  registerProspectTools(server);
  
  // Contact management tools
  registerContactTools(server);
  
  // Invoice and billing tools - TODO: Fix tRPC integration
  // registerInvoiceTools(server);
  
  // Transaction processing tools - TODO: Fix tRPC integration
  // registerTransactionTools(server);
  
  // Reporting and analytics tools - TODO: Fix tRPC integration
  // registerReportTools(server);
  
  console.log('Customer, vendor, employee, lead, prospect, and contact tools registered successfully');
}

/**
 * Helper function to create consistent tool responses
 */
export function createToolResponse(
  content: string,
  isError: boolean = false
) {
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

/**
 * Helper function to create structured data responses
 */
export function createDataResponse(
  message: string,
  data: any,
  isError: boolean = false
) {
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
 * Helper function to format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Helper function to format dates
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}