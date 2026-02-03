/**
 * GLAPI Conversational Ledger - Intent Types
 *
 * This module defines types for the AI intent system.
 * The actual intent data now comes from generated tools (OpenAPI source of truth).
 *
 * @deprecated Use generated tools via tool-adapter.ts instead of these types directly.
 * These types are kept for backward compatibility during migration.
 */

/**
 * Risk levels for intents
 * - LOW: Read-only operations, safe to execute
 * - MEDIUM: Creates or updates non-financial data
 * - HIGH: Modifies financial data or sensitive records
 * - CRITICAL: Irreversible operations (deletes, journal entries)
 *
 * @deprecated Use RiskLevel from './generated' instead
 */
export type IntentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Intent categories matching business domains
 *
 * @deprecated Categories are now inferred from tool names in tool-adapter.ts
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
 *
 * @deprecated Use permissions from generated tool metadata instead
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
 * Legacy intent definition structure
 *
 * @deprecated Use UnifiedToolInfo from './tool-adapter' instead
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

// =============================================================================
// Migration Notice
// =============================================================================
// The INTENT_CATALOG has been removed. Use the generated tools system instead:
//
// - getToolInfo(toolName) - Get tool info by name
// - getAllEnabledTools() - Get all enabled tools
// - getToolsByCategory(category) - Get tools by category
// - getHighRiskTools() - Get high-risk tools
//
// Import from './tool-adapter' for these functions.
// =============================================================================
