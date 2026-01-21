/**
 * GLAPI Conversational Ledger - Intent Catalog
 *
 * This module defines all supported conversational intents for the GLAPI assistant.
 * Each intent is categorized by domain, includes required permissions, risk level,
 * and whether confirmation is required before execution.
 */

/**
 * Risk levels for intents
 * - LOW: Read-only operations, safe to execute
 * - MEDIUM: Creates or updates non-financial data
 * - HIGH: Modifies financial data or sensitive records
 * - CRITICAL: Irreversible operations (deletes, journal entries)
 */
export type IntentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Intent categories matching business domains
 */
export type IntentCategory =
  | 'CUSTOMER_MANAGEMENT'
  | 'VENDOR_MANAGEMENT'
  | 'EMPLOYEE_MANAGEMENT'
  | 'LEAD_MANAGEMENT'
  | 'INVOICE_MANAGEMENT'
  | 'PAYMENT_MANAGEMENT'
  | 'JOURNAL_ENTRY'
  | 'REPORTING'
  | 'REVENUE_RECOGNITION'
  | 'INVENTORY_MANAGEMENT'
  | 'ACCOUNT_MANAGEMENT'
  | 'SYSTEM_CONFIGURATION'
  | 'GENERAL_INQUIRY';

/**
 * Permission scopes required for operations
 */
export type PermissionScope =
  | 'read:customers'
  | 'write:customers'
  | 'delete:customers'
  | 'read:vendors'
  | 'write:vendors'
  | 'delete:vendors'
  | 'read:employees'
  | 'write:employees'
  | 'delete:employees'
  | 'read:leads'
  | 'write:leads'
  | 'delete:leads'
  | 'read:invoices'
  | 'write:invoices'
  | 'delete:invoices'
  | 'read:payments'
  | 'write:payments'
  | 'read:journal_entries'
  | 'write:journal_entries'
  | 'post:journal_entries'
  | 'read:reports'
  | 'read:accounts'
  | 'write:accounts'
  | 'read:inventory'
  | 'write:inventory'
  | 'read:revenue'
  | 'write:revenue'
  | 'admin:settings';

/**
 * Intent definition structure
 */
export interface Intent {
  /** Unique intent identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Business domain category */
  category: IntentCategory;
  /** Risk level for guardrail evaluation */
  riskLevel: IntentRiskLevel;
  /** Required permissions */
  requiredPermissions: PermissionScope[];
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Example user utterances that trigger this intent */
  exampleUtterances: string[];
  /** MCP tool name to invoke */
  mcpTool: string;
  /** Whether this intent is currently enabled */
  enabled: boolean;
  /** Maximum calls per minute per user */
  rateLimitPerMinute?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete Intent Catalog
 *
 * This is the authoritative list of all supported conversational intents.
 * Each intent maps to specific MCP tools and includes safety metadata.
 */
export const INTENT_CATALOG: Record<string, Intent> = {
  // ============================================================================
  // CUSTOMER MANAGEMENT INTENTS
  // ============================================================================

  LIST_CUSTOMERS: {
    id: 'LIST_CUSTOMERS',
    name: 'List Customers',
    description: 'Retrieve and search customer records with optional filtering',
    category: 'CUSTOMER_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:customers'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all customers',
      'List active customers',
      'Find customers named Acme',
      'Who are our customers?',
      'Search for customer emails containing @gmail.com',
    ],
    mcpTool: 'list_customers',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  GET_CUSTOMER: {
    id: 'GET_CUSTOMER',
    name: 'Get Customer Details',
    description: 'Retrieve detailed information for a specific customer',
    category: 'CUSTOMER_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:customers'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me details for customer ABC',
      'Get customer information',
      "What's the status of customer XYZ?",
      'Pull up the Acme Corporation record',
    ],
    mcpTool: 'get_customer',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_CUSTOMER: {
    id: 'CREATE_CUSTOMER',
    name: 'Create Customer',
    description: 'Create a new customer record in the system',
    category: 'CUSTOMER_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:customers'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Create a new customer called Acme Corp',
      'Add a customer with email test@example.com',
      'Register a new customer',
      'Set up a new customer account',
    ],
    mcpTool: 'create_customer',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  UPDATE_CUSTOMER: {
    id: 'UPDATE_CUSTOMER',
    name: 'Update Customer',
    description: 'Update an existing customer record',
    category: 'CUSTOMER_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:customers'],
    requiresConfirmation: true,
    exampleUtterances: [
      "Update Acme's email address",
      "Change customer status to inactive",
      "Update the phone number for customer ABC",
      "Modify customer details",
    ],
    mcpTool: 'update_customer',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  // ============================================================================
  // VENDOR MANAGEMENT INTENTS
  // ============================================================================

  LIST_VENDORS: {
    id: 'LIST_VENDORS',
    name: 'List Vendors',
    description: 'Retrieve and search vendor records',
    category: 'VENDOR_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:vendors'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all vendors',
      'List our suppliers',
      'Find vendors',
      'Who are our vendors?',
    ],
    mcpTool: 'list_vendors',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  GET_VENDOR: {
    id: 'GET_VENDOR',
    name: 'Get Vendor Details',
    description: 'Retrieve detailed information for a specific vendor',
    category: 'VENDOR_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:vendors'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show vendor details',
      'Get vendor information',
      'What do we know about vendor XYZ?',
    ],
    mcpTool: 'get_vendor',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_VENDOR: {
    id: 'CREATE_VENDOR',
    name: 'Create Vendor',
    description: 'Create a new vendor record',
    category: 'VENDOR_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:vendors'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Add a new vendor',
      'Create vendor record',
      'Register a new supplier',
    ],
    mcpTool: 'create_vendor',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  UPDATE_VENDOR: {
    id: 'UPDATE_VENDOR',
    name: 'Update Vendor',
    description: 'Update an existing vendor record',
    category: 'VENDOR_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:vendors'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Update vendor information',
      'Change vendor status',
      'Modify vendor details',
    ],
    mcpTool: 'update_vendor',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  // ============================================================================
  // EMPLOYEE MANAGEMENT INTENTS
  // ============================================================================

  LIST_EMPLOYEES: {
    id: 'LIST_EMPLOYEES',
    name: 'List Employees',
    description: 'Retrieve and search employee records',
    category: 'EMPLOYEE_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:employees'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all employees',
      'List team members',
      'Who works here?',
      'Find employees',
    ],
    mcpTool: 'list_employees',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  GET_EMPLOYEE: {
    id: 'GET_EMPLOYEE',
    name: 'Get Employee Details',
    description: 'Retrieve detailed information for a specific employee',
    category: 'EMPLOYEE_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:employees'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show employee details',
      'Get employee information',
      "What's John's contact info?",
    ],
    mcpTool: 'get_employee',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_EMPLOYEE: {
    id: 'CREATE_EMPLOYEE',
    name: 'Create Employee',
    description: 'Create a new employee record',
    category: 'EMPLOYEE_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:employees'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Add a new employee',
      'Create employee record',
      'Onboard a new team member',
    ],
    mcpTool: 'create_employee',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  UPDATE_EMPLOYEE: {
    id: 'UPDATE_EMPLOYEE',
    name: 'Update Employee',
    description: 'Update an existing employee record',
    category: 'EMPLOYEE_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:employees'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Update employee information',
      'Change employee status',
      'Modify employee details',
    ],
    mcpTool: 'update_employee',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  // ============================================================================
  // LEAD/PROSPECT/CONTACT MANAGEMENT INTENTS
  // ============================================================================

  LIST_LEADS: {
    id: 'LIST_LEADS',
    name: 'List Leads',
    description: 'Retrieve and search lead records',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:leads'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all leads',
      'List sales leads',
      'Find leads',
      'What leads do we have?',
    ],
    mcpTool: 'list_leads',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_LEAD: {
    id: 'CREATE_LEAD',
    name: 'Create Lead',
    description: 'Create a new lead record',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:leads'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Add a new lead',
      'Create a lead',
      'Register a potential customer',
    ],
    mcpTool: 'create_lead',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  LIST_PROSPECTS: {
    id: 'LIST_PROSPECTS',
    name: 'List Prospects',
    description: 'Retrieve and search prospect records',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:leads'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all prospects',
      'List sales prospects',
      'Find prospects',
    ],
    mcpTool: 'list_prospects',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_PROSPECT: {
    id: 'CREATE_PROSPECT',
    name: 'Create Prospect',
    description: 'Create a new prospect record',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:leads'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Add a new prospect',
      'Create a prospect',
      'Register a prospect',
    ],
    mcpTool: 'create_prospect',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  LIST_CONTACTS: {
    id: 'LIST_CONTACTS',
    name: 'List Contacts',
    description: 'Retrieve and search contact records',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:leads'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all contacts',
      'List contacts',
      'Find contacts',
    ],
    mcpTool: 'list_contacts',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_CONTACT: {
    id: 'CREATE_CONTACT',
    name: 'Create Contact',
    description: 'Create a new contact record',
    category: 'LEAD_MANAGEMENT',
    riskLevel: 'MEDIUM',
    requiredPermissions: ['write:leads'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Add a new contact',
      'Create a contact',
      'Add contact information',
    ],
    mcpTool: 'create_contact',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  // ============================================================================
  // INVOICE MANAGEMENT INTENTS
  // ============================================================================

  LIST_INVOICES: {
    id: 'LIST_INVOICES',
    name: 'List Invoices',
    description: 'Retrieve and search invoice records',
    category: 'INVOICE_MANAGEMENT',
    riskLevel: 'LOW',
    requiredPermissions: ['read:invoices'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me all invoices',
      'List unpaid invoices',
      'Find invoices for customer ABC',
      'What invoices are outstanding?',
    ],
    mcpTool: 'list_invoices',
    enabled: true,
    rateLimitPerMinute: 60,
  },

  CREATE_INVOICE: {
    id: 'CREATE_INVOICE',
    name: 'Create Invoice',
    description: 'Create a new invoice for a customer',
    category: 'INVOICE_MANAGEMENT',
    riskLevel: 'HIGH',
    requiredPermissions: ['write:invoices'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Create an invoice for customer ABC',
      'Generate a new invoice',
      'Bill customer for $1000',
      'Create invoice with line items',
    ],
    mcpTool: 'create_invoice',
    enabled: true,
    rateLimitPerMinute: 20,
  },

  // ============================================================================
  // JOURNAL ENTRY INTENTS (HIGH RISK)
  // ============================================================================

  CREATE_JOURNAL_ENTRY: {
    id: 'CREATE_JOURNAL_ENTRY',
    name: 'Create Journal Entry',
    description: 'Create a new journal entry (general ledger transaction)',
    category: 'JOURNAL_ENTRY',
    riskLevel: 'CRITICAL',
    requiredPermissions: ['write:journal_entries'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Create a journal entry',
      'Record an adjusting entry',
      'Post a debit/credit entry',
      'Make a GL entry',
    ],
    mcpTool: 'create_journal_entry',
    enabled: true,
    rateLimitPerMinute: 10,
    metadata: {
      requiresBalancedEntry: true,
      auditRequired: true,
    },
  },

  POST_JOURNAL_ENTRY: {
    id: 'POST_JOURNAL_ENTRY',
    name: 'Post Journal Entry',
    description: 'Post a draft journal entry to the general ledger',
    category: 'JOURNAL_ENTRY',
    riskLevel: 'CRITICAL',
    requiredPermissions: ['post:journal_entries'],
    requiresConfirmation: true,
    exampleUtterances: [
      'Post the journal entry',
      'Finalize the entry',
      'Submit the journal entry',
    ],
    mcpTool: 'post_journal_entry',
    enabled: true,
    rateLimitPerMinute: 10,
    metadata: {
      irreversible: true,
      auditRequired: true,
    },
  },

  // ============================================================================
  // REPORTING INTENTS
  // ============================================================================

  GENERATE_BALANCE_SHEET: {
    id: 'GENERATE_BALANCE_SHEET',
    name: 'Generate Balance Sheet',
    description: 'Generate a balance sheet report',
    category: 'REPORTING',
    riskLevel: 'LOW',
    requiredPermissions: ['read:reports'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me the balance sheet',
      'Generate balance sheet for Q1',
      "What's our financial position?",
      'Pull up the balance sheet',
    ],
    mcpTool: 'generate_balance_sheet',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  GENERATE_INCOME_STATEMENT: {
    id: 'GENERATE_INCOME_STATEMENT',
    name: 'Generate Income Statement',
    description: 'Generate an income statement (P&L) report',
    category: 'REPORTING',
    riskLevel: 'LOW',
    requiredPermissions: ['read:reports'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me the income statement',
      'Generate P&L report',
      "What's our profit/loss?",
      'Pull up the profit and loss statement',
    ],
    mcpTool: 'generate_income_statement',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  GENERATE_CASH_FLOW: {
    id: 'GENERATE_CASH_FLOW',
    name: 'Generate Cash Flow Statement',
    description: 'Generate a cash flow statement',
    category: 'REPORTING',
    riskLevel: 'LOW',
    requiredPermissions: ['read:reports'],
    requiresConfirmation: false,
    exampleUtterances: [
      'Show me the cash flow statement',
      'Generate cash flow report',
      "What's our cash position?",
    ],
    mcpTool: 'generate_cash_flow',
    enabled: true,
    rateLimitPerMinute: 30,
  },

  // ============================================================================
  // GENERAL INQUIRY INTENTS
  // ============================================================================

  GENERAL_HELP: {
    id: 'GENERAL_HELP',
    name: 'General Help',
    description: 'Provide help and guidance about using the system',
    category: 'GENERAL_INQUIRY',
    riskLevel: 'LOW',
    requiredPermissions: [],
    requiresConfirmation: false,
    exampleUtterances: [
      'Help',
      'What can you do?',
      'How do I use this?',
      'What commands are available?',
    ],
    mcpTool: 'help',
    enabled: true,
    rateLimitPerMinute: 100,
  },

  EXPLAIN_CONCEPT: {
    id: 'EXPLAIN_CONCEPT',
    name: 'Explain Concept',
    description: 'Explain accounting or business concepts',
    category: 'GENERAL_INQUIRY',
    riskLevel: 'LOW',
    requiredPermissions: [],
    requiresConfirmation: false,
    exampleUtterances: [
      'What is a journal entry?',
      'Explain revenue recognition',
      'What is ASC 606?',
      'How does double-entry accounting work?',
    ],
    mcpTool: 'explain_concept',
    enabled: true,
    rateLimitPerMinute: 60,
  },
};

/**
 * Get all intents for a specific category
 */
export function getIntentsByCategory(category: IntentCategory): Intent[] {
  return Object.values(INTENT_CATALOG).filter((intent) => intent.category === category);
}

/**
 * Get all intents that require confirmation
 */
export function getHighRiskIntents(): Intent[] {
  return Object.values(INTENT_CATALOG).filter(
    (intent) => intent.riskLevel === 'HIGH' || intent.riskLevel === 'CRITICAL'
  );
}

/**
 * Get an intent by its ID
 */
export function getIntentById(id: string): Intent | undefined {
  return INTENT_CATALOG[id];
}

/**
 * Get an intent by MCP tool name
 */
export function getIntentByMcpTool(toolName: string): Intent | undefined {
  return Object.values(INTENT_CATALOG).find((intent) => intent.mcpTool === toolName);
}

/**
 * Check if an intent is enabled
 */
export function isIntentEnabled(intentId: string): boolean {
  const intent = INTENT_CATALOG[intentId];
  return intent?.enabled ?? false;
}

/**
 * Get all enabled intents
 */
export function getEnabledIntents(): Intent[] {
  return Object.values(INTENT_CATALOG).filter((intent) => intent.enabled);
}
