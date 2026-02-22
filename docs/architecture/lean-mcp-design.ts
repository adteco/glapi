/**
 * Lean GLAPI MCP Design
 *
 * This MCP provides ONLY what can't be expressed in OpenAPI:
 * - Resources (prompts, templates, context)
 * - Multi-step workflows
 * - Context-aware intelligence
 *
 * CRUD operations are accessed via OpenAPI, not MCP.
 */

// =============================================================================
// RESOURCES - Static content the AI needs
// =============================================================================

export const MCP_RESOURCES = {
  // Prompt templates for document processing
  prompts: {
    'invoice-processing': {
      uri: 'glapi://prompts/invoice-processing',
      name: 'Invoice Processing Prompt',
      description: 'System prompt for analyzing and processing incoming invoices',
      mimeType: 'text/markdown',
    },
    'po-matching': {
      uri: 'glapi://prompts/po-matching',
      name: 'Purchase Order Matching Prompt',
      description: 'Instructions for matching invoices to purchase orders',
      mimeType: 'text/markdown',
    },
    'vendor-identification': {
      uri: 'glapi://prompts/vendor-identification',
      name: 'Vendor Identification Prompt',
      description: 'How to identify and match vendors from document data',
      mimeType: 'text/markdown',
    },
    'approval-routing': {
      uri: 'glapi://prompts/approval-routing',
      name: 'Approval Routing Rules',
      description: 'Rules for routing documents to appropriate approvers',
      mimeType: 'text/markdown',
    },
  },

  // Report templates
  templates: {
    'wip-report': {
      uri: 'glapi://templates/wip-report',
      name: 'WIP Report Template',
      description: 'Work-in-progress report structure',
      mimeType: 'application/json',
    },
    'aging-report': {
      uri: 'glapi://templates/aging-report',
      name: 'Aging Report Template',
      description: 'AR/AP aging report structure',
      mimeType: 'application/json',
    },
  },

  // Dynamic context (requires org context)
  context: {
    'pending-approvals': {
      uri: 'glapi://context/pending-approvals',
      name: 'Pending Approvals',
      description: 'Items awaiting current user approval',
      mimeType: 'application/json',
    },
    'recent-activity': {
      uri: 'glapi://context/recent-activity',
      name: 'Recent Activity',
      description: 'Recent actions in the organization',
      mimeType: 'application/json',
    },
    'alerts': {
      uri: 'glapi://context/alerts',
      name: 'Active Alerts',
      description: 'Warnings and alerts needing attention',
      mimeType: 'application/json',
    },
  },
};

// =============================================================================
// TOOLS - Multi-step workflows and intelligence (NOT CRUD)
// =============================================================================

export const MCP_TOOLS = {
  // ---------------------------------------------------------------------
  // Document Processing Workflows
  // ---------------------------------------------------------------------

  'process_inbound_document': {
    name: 'process_inbound_document',
    description: `
      End-to-end document processing workflow:
      1. Classify document type
      2. Extract key entities (vendor, amounts, dates)
      3. Match to existing records (PO, contract, customer)
      4. Create appropriate record (bill, invoice, receipt)
      5. Route for approval if needed
      6. Return summary of actions taken

      This is a multi-step orchestration that calls multiple OpenAPI endpoints.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        documentType: {
          type: 'string',
          enum: ['invoice', 'purchase_order', 'receipt', 'contract', 'unknown'],
          description: 'Pre-classified document type (or unknown for auto-detect)',
        },
        s3Bucket: { type: 'string' },
        s3Key: { type: 'string' },
        extractedData: {
          type: 'object',
          description: 'Pre-extracted data from magic-inbox-processor',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, return what would happen without creating records',
        },
      },
      required: ['s3Bucket', 's3Key'],
    },
  },

  'suggest_action': {
    name: 'suggest_action',
    description: `
      Given context about a document or situation, suggest the best action.
      Uses organization's historical patterns and rules to recommend next steps.

      Returns ranked suggestions with confidence scores.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'object',
          properties: {
            documentType: { type: 'string' },
            vendorName: { type: 'string' },
            amount: { type: 'number' },
            hasMatchingPO: { type: 'boolean' },
            isRecurring: { type: 'boolean' },
          },
        },
        maxSuggestions: { type: 'number', default: 3 },
      },
      required: ['context'],
    },
  },

  // ---------------------------------------------------------------------
  // Context-Aware Queries (aggregated intelligence)
  // ---------------------------------------------------------------------

  'whats_pending': {
    name: 'whats_pending',
    description: `
      Get a prioritized summary of what needs attention:
      - Pending approvals
      - Overdue items
      - Unmatched documents
      - Alerts and warnings

      Aggregates across multiple entity types and returns prioritized list.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['approvals', 'overdue', 'unmatched', 'alerts', 'all'],
          },
          default: ['all'],
        },
        limit: { type: 'number', default: 20 },
      },
    },
  },

  'summarize_entity': {
    name: 'summarize_entity',
    description: `
      Get a comprehensive summary of an entity with related context:
      - Customer: recent orders, open invoices, payment history, contacts
      - Vendor: recent bills, open POs, payment terms, performance
      - Project: WIP status, budget vs actual, upcoming milestones

      Aggregates data that would require multiple OpenAPI calls.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['customer', 'vendor', 'project', 'contract', 'employee'],
        },
        entityId: { type: 'string' },
        includeSections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Which sections to include in summary',
        },
      },
      required: ['entityType', 'entityId'],
    },
  },

  // ---------------------------------------------------------------------
  // Batch/Complex Operations
  // ---------------------------------------------------------------------

  'reconcile_period': {
    name: 'reconcile_period',
    description: `
      Reconcile a fiscal period:
      1. Identify unmatched transactions
      2. Suggest matches based on patterns
      3. Flag discrepancies
      4. Generate reconciliation report

      Requires confirmation before making changes.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        periodStart: { type: 'string', format: 'date' },
        periodEnd: { type: 'string', format: 'date' },
        accountTypes: {
          type: 'array',
          items: { type: 'string', enum: ['ar', 'ap', 'bank', 'all'] },
        },
        autoMatch: {
          type: 'boolean',
          description: 'Auto-match high-confidence items',
        },
        dryRun: { type: 'boolean', default: true },
      },
      required: ['periodStart', 'periodEnd'],
    },
  },

  'bulk_status_update': {
    name: 'bulk_status_update',
    description: `
      Update status on multiple records with validation:
      1. Validate all records can transition to new status
      2. Check for blockers (dependencies, approvals needed)
      3. Apply updates in transaction
      4. Trigger notifications

      Returns success/failure for each record.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        entityType: { type: 'string' },
        recordIds: { type: 'array', items: { type: 'string' } },
        newStatus: { type: 'string' },
        reason: { type: 'string' },
        skipValidation: { type: 'boolean', default: false },
      },
      required: ['entityType', 'recordIds', 'newStatus'],
    },
  },

  // ---------------------------------------------------------------------
  // Approval & Human-in-the-Loop
  // ---------------------------------------------------------------------

  'request_approval': {
    name: 'request_approval',
    description: `
      Route a decision to appropriate human approver:
      1. Determine approval routing based on rules
      2. Create approval request with context
      3. Notify approver(s)
      4. Return approval request ID for tracking
    `,
    inputSchema: {
      type: 'object',
      properties: {
        actionType: {
          type: 'string',
          description: 'What action needs approval',
        },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        proposedChanges: { type: 'object' },
        urgency: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        context: { type: 'string', description: 'Additional context for approver' },
      },
      required: ['actionType', 'entityType', 'entityId'],
    },
  },
};

// =============================================================================
// PROMPTS - Stored prompt templates (MCP prompts feature)
// =============================================================================

export const MCP_PROMPTS = {
  'analyze-invoice': {
    name: 'analyze-invoice',
    description: 'Analyze an invoice and extract structured data',
    arguments: [
      { name: 'vendor_name', description: 'Known vendor name if available', required: false },
      { name: 'expected_amount', description: 'Expected amount if from PO', required: false },
    ],
  },

  'match-to-po': {
    name: 'match-to-po',
    description: 'Match a document to existing purchase orders',
    arguments: [
      { name: 'vendor_id', required: true },
      { name: 'amount', required: true },
      { name: 'date_range_days', required: false },
    ],
  },

  'generate-summary': {
    name: 'generate-summary',
    description: 'Generate a natural language summary of entity or period',
    arguments: [
      { name: 'entity_type', required: true },
      { name: 'entity_id', required: true },
      { name: 'time_period', required: false },
    ],
  },
};
