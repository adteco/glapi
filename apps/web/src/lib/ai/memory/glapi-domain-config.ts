/**
 * GLAPI Domain Configuration for Magneteco Memory Service
 *
 * This configuration tells magneteco what to remember about GLAPI users,
 * including accounting entities, revenue recognition context, and AI tool usage.
 */

import type { DomainConfig } from './magneteco-client';

/**
 * Categories of facts magneteco should extract and remember for GLAPI
 */
const GLAPI_CATEGORIES = [
  {
    name: 'business_context',
    description:
      'Information about the user\'s business: company type, industry, fiscal year, accounting preferences',
    alwaysInclude: true,
    maxSummaryTokens: 400,
  },
  {
    name: 'revenue_recognition',
    description:
      'Revenue recognition preferences: ASC 606 compliance, performance obligation handling, recognition methods',
    alwaysInclude: true,
    maxSummaryTokens: 300,
  },
  {
    name: 'customer_relationships',
    description:
      'Key customers, contracts, and ongoing business relationships the user frequently works with',
    maxSummaryTokens: 400,
  },
  {
    name: 'workflow_preferences',
    description:
      'How the user prefers to work: reporting frequency, approval workflows, notification preferences',
    maxSummaryTokens: 300,
  },
  {
    name: 'tool_usage',
    description:
      'Which GLAPI AI tools the user frequently uses and their preferred parameters',
    maxSummaryTokens: 200,
  },
  {
    name: 'accounting_dimensions',
    description:
      'Frequently used accounting dimensions: departments, classes, locations, subsidiaries',
    maxSummaryTokens: 300,
  },
];

/**
 * Entity types that magneteco should recognize and track relationships for
 */
const GLAPI_ENTITY_TYPES = [
  {
    name: 'Customer',
    description: 'A customer who purchases goods or services',
    properties: [
      { name: 'name', type: 'string' as const, description: 'Customer name' },
      { name: 'customerId', type: 'string' as const, description: 'GLAPI customer ID' },
      { name: 'industry', type: 'string' as const, description: 'Industry sector' },
      { name: 'tier', type: 'string' as const, description: 'Customer tier (enterprise, mid-market, SMB)' },
    ],
  },
  {
    name: 'Contract',
    description: 'A revenue contract with performance obligations',
    properties: [
      { name: 'contractNumber', type: 'string' as const, description: 'Contract identifier' },
      { name: 'value', type: 'number' as const, description: 'Total contract value' },
      { name: 'startDate', type: 'date' as const, description: 'Contract start date' },
      { name: 'endDate', type: 'date' as const, description: 'Contract end date' },
      { name: 'status', type: 'string' as const, description: 'Contract status' },
    ],
  },
  {
    name: 'PerformanceObligation',
    description: 'A distinct performance obligation under ASC 606',
    properties: [
      { name: 'description', type: 'string' as const, description: 'Obligation description' },
      { name: 'type', type: 'string' as const, description: 'Type (point-in-time or over-time)' },
      { name: 'value', type: 'number' as const, description: 'Allocated transaction price' },
    ],
  },
  {
    name: 'Invoice',
    description: 'An invoice issued to a customer',
    properties: [
      { name: 'invoiceNumber', type: 'string' as const, description: 'Invoice number' },
      { name: 'amount', type: 'number' as const, description: 'Invoice amount' },
      { name: 'dueDate', type: 'date' as const, description: 'Payment due date' },
      { name: 'status', type: 'string' as const, description: 'Invoice status' },
    ],
  },
  {
    name: 'Project',
    description: 'A project for tracking work and revenue',
    properties: [
      { name: 'name', type: 'string' as const, description: 'Project name' },
      { name: 'projectId', type: 'string' as const, description: 'Project identifier' },
      { name: 'status', type: 'string' as const, description: 'Project status' },
    ],
  },
  {
    name: 'Department',
    description: 'An organizational department for accounting segmentation',
    properties: [
      { name: 'name', type: 'string' as const, description: 'Department name' },
      { name: 'code', type: 'string' as const, description: 'Department code' },
    ],
  },
  {
    name: 'Subsidiary',
    description: 'A subsidiary company in a multi-entity structure',
    properties: [
      { name: 'name', type: 'string' as const, description: 'Subsidiary name' },
      { name: 'currency', type: 'string' as const, description: 'Functional currency' },
    ],
  },
];

/**
 * Relationship types for the knowledge graph
 */
const GLAPI_RELATIONSHIP_TYPES = [
  {
    name: 'HAS_CONTRACT',
    description: 'Customer has a contract',
    fromTypes: ['Customer'],
    toTypes: ['Contract'],
  },
  {
    name: 'INCLUDES_OBLIGATION',
    description: 'Contract includes a performance obligation',
    fromTypes: ['Contract'],
    toTypes: ['PerformanceObligation'],
  },
  {
    name: 'INVOICED_FOR',
    description: 'Invoice is for a contract or obligation',
    fromTypes: ['Invoice'],
    toTypes: ['Contract', 'PerformanceObligation'],
  },
  {
    name: 'BILLED_TO',
    description: 'Invoice is billed to a customer',
    fromTypes: ['Invoice'],
    toTypes: ['Customer'],
  },
  {
    name: 'ASSIGNED_TO',
    description: 'Project is assigned to a customer',
    fromTypes: ['Project'],
    toTypes: ['Customer'],
  },
  {
    name: 'BELONGS_TO',
    description: 'Entity belongs to a department or subsidiary',
    fromTypes: ['Contract', 'Invoice', 'Project'],
    toTypes: ['Department', 'Subsidiary'],
  },
  {
    name: 'RELATED_TO',
    description: 'General relationship between entities mentioned together',
    fromTypes: ['Customer', 'Contract', 'Invoice', 'Project'],
    toTypes: ['Customer', 'Contract', 'Invoice', 'Project'],
  },
];

/**
 * Relevance rules for what to remember
 */
const GLAPI_RELEVANCE_RULES = [
  {
    type: 'always_remember' as const,
    pattern: 'ASC 606|revenue recognition|performance obligation',
    description: 'Always remember revenue recognition compliance details',
  },
  {
    type: 'always_remember' as const,
    pattern: 'fiscal year|accounting period|close',
    description: 'Always remember fiscal calendar preferences',
  },
  {
    type: 'boost' as const,
    pattern: 'contract value|deal size|revenue',
    description: 'Boost importance of financial amounts',
    factor: 1.5,
  },
  {
    type: 'decay' as const,
    pattern: 'test|demo|sandbox',
    description: 'Decay test/demo data faster',
    factor: 0.5,
  },
  {
    type: 'never_remember' as const,
    pattern: 'password|secret|token|key',
    description: 'Never store credentials or secrets',
  },
];

/**
 * Custom extraction prompt additions that teach the LLM about GLAPI
 */
const GLAPI_EXTRACTION_PROMPT = `
## GLAPI Context

You are analyzing conversations from GLAPI, a revenue recognition and accounting dimensions API platform. The user manages:

### Core Business Entities
- **Customers**: Companies that purchase goods/services
- **Contracts**: Revenue contracts governed by ASC 606
- **Performance Obligations**: Distinct promises within contracts (point-in-time or over-time recognition)
- **Invoices**: Billing documents linked to contracts
- **Projects**: Work tracking for services revenue

### Accounting Dimensions
- **Departments**: Organizational units for cost/revenue allocation
- **Classes**: Business line segmentation
- **Locations**: Geographic tracking
- **Subsidiaries**: Multi-entity company structure

### Revenue Recognition (ASC 606)
The five-step model:
1. Identify the contract with a customer
2. Identify the performance obligations
3. Determine the transaction price
4. Allocate the transaction price
5. Recognize revenue when obligations are satisfied

### AI Tools Available
GLAPI provides these AI-powered tools:
- Customer management (list, create, update, delete)
- Contract management with performance obligations
- Revenue recognition calculations
- Invoice generation and tracking
- Accounting dimension management
- Financial reporting and analytics

### What to Extract
Pay special attention to:
- User's fiscal year and accounting period preferences
- Revenue recognition method preferences (point-in-time vs over-time)
- Frequently accessed customers and contracts
- Reporting preferences and approval workflows
- Common accounting dimension combinations
- Tool usage patterns and preferred parameters
`;

/**
 * Complete GLAPI domain configuration
 */
export const glapiDomainConfig: Omit<DomainConfig, 'appId'> = {
  name: 'GLAPI Revenue Recognition Assistant',
  description:
    'Domain configuration for GLAPI AI assistant that helps with revenue recognition, contract management, and accounting operations.',
  version: '1.0.0',

  categories: GLAPI_CATEGORIES,
  entityTypes: GLAPI_ENTITY_TYPES,
  relationshipTypes: GLAPI_RELATIONSHIP_TYPES,
  relevanceRules: GLAPI_RELEVANCE_RULES,
  extractionPromptAdditions: GLAPI_EXTRACTION_PROMPT,

  // Limits
  maxItemsPerUser: 10000,
  maxEntitiesPerUser: 2000,
  retentionDays: 730, // 2 years for accounting context
};

/**
 * Create the full domain config with app ID
 */
export function createGlapiDomainConfig(appId: string): DomainConfig {
  return {
    appId,
    ...glapiDomainConfig,
  };
}

/**
 * Export individual components for customization
 */
export {
  GLAPI_CATEGORIES,
  GLAPI_ENTITY_TYPES,
  GLAPI_RELATIONSHIP_TYPES,
  GLAPI_RELEVANCE_RULES,
  GLAPI_EXTRACTION_PROMPT,
};
