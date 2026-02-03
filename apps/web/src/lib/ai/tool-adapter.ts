/**
 * Tool Adapter - Bridges Generated Tools to Guardrails System
 *
 * This module provides compatibility between the generated AI tool metadata
 * and the existing guardrails/intent system. It allows the guardrails to
 * consume either legacy intents or generated tool metadata seamlessly.
 *
 * @module tool-adapter
 */

import {
  AI_TOOLS_BY_NAME,
  type GeneratedAITool,
  type AIToolMetadata,
  type RiskLevel,
  type UserRole,
} from './generated';
import {
  type Intent,
  type IntentRiskLevel,
  type PermissionScope,
  type IntentCategory,
  INTENT_CATALOG,
} from './intents';
import type { AIPolicy } from './policy-evaluator';

// =============================================================================
// Types
// =============================================================================

/**
 * Unified tool info that works with both generated tools and legacy intents
 */
export interface UnifiedToolInfo {
  /** Tool/Intent ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tool description */
  description: string;
  /** Risk level */
  riskLevel: IntentRiskLevel;
  /** Whether confirmation is required */
  requiresConfirmation: boolean;
  /** Whether dry-run is supported */
  supportsDryRun: boolean;
  /** Confirmation message template */
  confirmationMessage?: string;
  /** Required permissions */
  requiredPermissions: PermissionScope[];
  /** Minimum role required */
  minimumRole: UserRole;
  /** Whether the tool is enabled */
  enabled: boolean;
  /** Rate limit per minute */
  rateLimitPerMinute?: number;
  /** Business domain category */
  category?: IntentCategory;
  /** Tool scopes for dynamic loading */
  scopes: string[];
  /** Source of the tool info */
  source: 'generated' | 'legacy';
  /** Original generated tool (if from generated) */
  generatedTool?: GeneratedAITool;
  /** Original intent (if from legacy) */
  legacyIntent?: Intent;
  /** x-ai-policy rules for tier/MFA/row-scope enforcement */
  policy?: AIPolicy;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Map generated tool risk level to intent risk level
 */
function mapRiskLevel(level: RiskLevel): IntentRiskLevel {
  // Both use the same levels: LOW, MEDIUM, HIGH, CRITICAL
  return level;
}

/**
 * Map generated tool permissions to permission scopes
 * The generated tools use the same permission format
 */
function mapPermissions(permissions: string[]): PermissionScope[] {
  return permissions as PermissionScope[];
}

/**
 * Infer category from tool name for generated tools
 */
function inferCategory(toolName: string): IntentCategory | undefined {
  const categoryPatterns: Record<string, IntentCategory> = {
    customer: 'CUSTOMER_MANAGEMENT',
    vendor: 'VENDOR_MANAGEMENT',
    employee: 'EMPLOYEE_MANAGEMENT',
    lead: 'LEAD_MANAGEMENT',
    prospect: 'LEAD_MANAGEMENT',
    contact: 'LEAD_MANAGEMENT',
    invoice: 'INVOICE_MANAGEMENT',
    payment: 'PAYMENT_MANAGEMENT',
    journal: 'JOURNAL_ENTRY',
    report: 'REPORTING',
    balance_sheet: 'REPORTING',
    income_statement: 'REPORTING',
    cash_flow: 'REPORTING',
    revenue: 'REVENUE_RECOGNITION',
    inventory: 'INVENTORY_MANAGEMENT',
    account: 'ACCOUNT_MANAGEMENT',
    chart_of_accounts: 'ACCOUNT_MANAGEMENT',
    subsidiary: 'ACCOUNT_MANAGEMENT',
    department: 'ACCOUNT_MANAGEMENT',
    location: 'ACCOUNT_MANAGEMENT',
    class: 'ACCOUNT_MANAGEMENT',
  };

  const lowerName = toolName.toLowerCase();
  for (const [pattern, category] of Object.entries(categoryPatterns)) {
    if (lowerName.includes(pattern)) {
      return category;
    }
  }

  return 'GENERAL_INQUIRY';
}

/**
 * Convert a generated tool to unified tool info
 */
export function generatedToolToUnified(tool: GeneratedAITool): UnifiedToolInfo {
  const { metadata } = tool;

  return {
    id: metadata.operationId.replace(/\./g, '_').toUpperCase(),
    name: formatToolName(metadata.name),
    description: metadata.description,
    riskLevel: mapRiskLevel(metadata.risk.level),
    requiresConfirmation: metadata.risk.requiresConfirmation,
    supportsDryRun: metadata.risk.supportsDryRun,
    confirmationMessage: metadata.risk.confirmationMessage,
    requiredPermissions: mapPermissions(metadata.permissions.required),
    minimumRole: metadata.permissions.minimumRole,
    enabled: metadata.enabled,
    rateLimitPerMinute: metadata.rateLimit?.requestsPerMinute,
    category: inferCategory(metadata.name),
    scopes: metadata.scopes,
    source: 'generated',
    generatedTool: tool,
    // x-ai-policy extension (will be populated when generator is updated)
    policy: (metadata as AIToolMetadata & { policy?: AIPolicy }).policy,
  };
}

/**
 * Convert a legacy intent to unified tool info
 */
export function intentToUnified(intent: Intent): UnifiedToolInfo {
  return {
    id: intent.id,
    name: intent.name,
    description: intent.description,
    riskLevel: intent.riskLevel,
    requiresConfirmation: intent.requiresConfirmation,
    supportsDryRun: false,
    requiredPermissions: intent.requiredPermissions,
    minimumRole: deriveMinimumRole(intent),
    enabled: intent.enabled,
    rateLimitPerMinute: intent.rateLimitPerMinute,
    category: intent.category,
    scopes: ['global'], // Legacy intents are globally scoped
    source: 'legacy',
    legacyIntent: intent,
  };
}

/**
 * Derive minimum role from intent permissions and risk level
 */
function deriveMinimumRole(intent: Intent): UserRole {
  // Check for admin permissions
  if (intent.requiredPermissions.some(p => p.startsWith('admin:'))) {
    return 'admin';
  }

  // Critical operations require accountant or admin
  if (intent.riskLevel === 'CRITICAL') {
    return 'accountant';
  }

  // Write operations require at least staff
  if (intent.requiredPermissions.some(p => p.startsWith('write:') || p.startsWith('delete:'))) {
    return 'staff';
  }

  // Read-only operations can be performed by viewer
  return 'viewer';
}

/**
 * Format tool name for display (snake_case to Title Case)
 */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// Tool Lookup Functions
// =============================================================================

/**
 * Get unified tool info by tool name
 * Prefers generated tools over legacy intents
 */
export function getToolInfo(toolName: string): UnifiedToolInfo | undefined {
  // First check generated tools (AI_TOOLS_BY_NAME is a Map)
  const generatedTool = AI_TOOLS_BY_NAME.get(toolName);
  if (generatedTool) {
    return generatedToolToUnified(generatedTool);
  }

  // Fall back to legacy intents
  const intent = Object.values(INTENT_CATALOG).find(i => i.mcpTool === toolName);
  if (intent) {
    return intentToUnified(intent);
  }

  return undefined;
}

/**
 * Get unified tool info by ID
 */
export function getToolInfoById(id: string): UnifiedToolInfo | undefined {
  // Check legacy intents first (they use IDs like LIST_CUSTOMERS)
  const intent = INTENT_CATALOG[id];
  if (intent) {
    return intentToUnified(intent);
  }

  // Check generated tools by converting ID to tool name (AI_TOOLS_BY_NAME is a Map)
  const toolName = id.toLowerCase().replace(/_/g, '_');
  const generatedTool = AI_TOOLS_BY_NAME.get(toolName);
  if (generatedTool) {
    return generatedToolToUnified(generatedTool);
  }

  return undefined;
}

/**
 * Check if a tool is enabled
 */
export function isToolEnabled(toolName: string): boolean {
  const toolInfo = getToolInfo(toolName);
  return toolInfo?.enabled ?? false;
}

/**
 * Get all enabled tools as unified info
 */
export function getAllEnabledTools(): UnifiedToolInfo[] {
  const tools: UnifiedToolInfo[] = [];
  const seenNames = new Set<string>();

  // Add generated tools first (they take precedence) - AI_TOOLS_BY_NAME is a Map
  for (const tool of AI_TOOLS_BY_NAME.values()) {
    if (tool.metadata.enabled) {
      tools.push(generatedToolToUnified(tool));
      seenNames.add(tool.metadata.name);
    }
  }

  // Add legacy intents that don't have generated equivalents
  for (const intent of Object.values(INTENT_CATALOG)) {
    if (intent.enabled && !seenNames.has(intent.mcpTool)) {
      tools.push(intentToUnified(intent));
    }
  }

  return tools;
}

/**
 * Get tools by scope
 */
export function getToolsByScope(scope: string): UnifiedToolInfo[] {
  return getAllEnabledTools().filter(tool => tool.scopes.includes(scope));
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: IntentCategory): UnifiedToolInfo[] {
  return getAllEnabledTools().filter(tool => tool.category === category);
}

/**
 * Get high-risk tools (HIGH or CRITICAL)
 */
export function getHighRiskTools(): UnifiedToolInfo[] {
  return getAllEnabledTools().filter(
    tool => tool.riskLevel === 'HIGH' || tool.riskLevel === 'CRITICAL'
  );
}

// =============================================================================
// Role/Permission Utilities
// =============================================================================

/**
 * Extended role type that includes api_client from guardrails
 */
export type ExtendedUserRole = UserRole | 'api_client';

/**
 * Role hierarchy for permission checks
 * Includes api_client which is treated as equivalent to manager for access control
 */
const ROLE_HIERARCHY: Record<ExtendedUserRole, number> = {
  viewer: 0,
  staff: 1,
  manager: 2,
  api_client: 2, // API clients have similar access to managers
  accountant: 3,
  admin: 4,
};

/**
 * Check if a role meets the minimum role requirement
 * Supports both generated UserRole and extended roles like api_client
 */
export function roleAtLeast(userRole: ExtendedUserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if user can access a tool based on role
 */
export function canAccessTool(userRole: UserRole, tool: UnifiedToolInfo): boolean {
  return roleAtLeast(userRole, tool.minimumRole);
}
