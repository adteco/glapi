/**
 * Dynamic Tool Scoping
 *
 * This module provides intelligent tool selection to optimize LLM context usage.
 * Instead of loading all 105 tools, it selects relevant tools based on:
 * - User role and permissions
 * - Current conversation context
 * - Active features/modules
 * - User preferences
 */

import { getToolsByScope, AI_TOOLS, type GeneratedAITool, type UserRole } from './generated';
import { type ExtendedUserRole, roleAtLeast } from './tool-adapter';

// =============================================================================
// Types
// =============================================================================

/**
 * Scoping context for tool selection
 */
export interface ScopingContext {
  /** User's role */
  userRole: ExtendedUserRole;
  /** User's explicit permissions */
  permissions: string[];
  /** Active features/modules for the user's organization */
  activeFeatures?: string[];
  /** Current conversation context hints */
  contextHints?: string[];
  /** Maximum number of tools to return */
  maxTools?: number;
  /** Minimum risk level to include (exclude riskier tools) */
  maxRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Result of scope evaluation
 */
export interface ScopingResult {
  /** Selected tools */
  tools: GeneratedAITool[];
  /** Scopes that were applied */
  appliedScopes: string[];
  /** Reason for scope selection */
  reason: string;
  /** Total available tools (before scoping) */
  totalAvailable: number;
}

// =============================================================================
// Scope Definitions
// =============================================================================

/**
 * Predefined scope bundles for common use cases
 */
export const SCOPE_BUNDLES: Record<string, string[]> = {
  // Role-based bundles
  viewer: ['global'], // Viewers get read-only tools
  staff: ['global', 'customers', 'vendors', 'leads'],
  manager: ['global', 'customers', 'vendors', 'leads', 'employees', 'reporting'],
  accountant: ['global', 'customers', 'vendors', 'invoices', 'payments', 'journal', 'reporting'],
  admin: ['global'], // Admins get all tools

  // Feature-based bundles
  sales: ['customers', 'leads', 'prospects', 'contacts', 'invoices'],
  purchasing: ['vendors', 'purchase_orders', 'vendor_bills'],
  accounting: ['invoices', 'payments', 'journal', 'accounts', 'reporting'],
  hr: ['employees'],
  inventory: ['inventory', 'items'],
  construction: ['projects', 'budgets'],

  // Conversation context bundles
  onboarding: ['customers', 'vendors', 'employees'],
  financial_reports: ['reporting', 'accounts'],
  data_entry: ['customers', 'vendors', 'invoices', 'journal'],
};

/**
 * Risk level hierarchy
 */
const RISK_LEVEL_ORDER: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get tools based on user role
 */
export function getToolsForRole(role: ExtendedUserRole): GeneratedAITool[] {
  // Special handling for api_client
  const effectiveRole = role === 'api_client' ? 'manager' : role;

  const scopes = SCOPE_BUNDLES[effectiveRole] || SCOPE_BUNDLES.staff;

  // Admin gets all tools
  if (role === 'admin') {
    return AI_TOOLS.filter(t => t.metadata.enabled);
  }

  return getToolsByScope(scopes).filter(t => t.metadata.enabled);
}

/**
 * Filter tools by permission requirements
 */
export function filterByPermissions(
  tools: GeneratedAITool[],
  userPermissions: string[]
): GeneratedAITool[] {
  return tools.filter(tool => {
    const requiredPerms = tool.metadata.permissions.required;
    // Allow if user has at least one required permission or tool has no requirements
    return requiredPerms.length === 0 ||
      requiredPerms.some(perm => userPermissions.includes(perm));
  });
}

/**
 * Filter tools by minimum role
 */
export function filterByMinimumRole(
  tools: GeneratedAITool[],
  userRole: ExtendedUserRole
): GeneratedAITool[] {
  return tools.filter(tool => {
    const minRole = tool.metadata.permissions.minimumRole;
    return roleAtLeast(userRole, minRole);
  });
}

/**
 * Filter tools by risk level
 */
export function filterByRiskLevel(
  tools: GeneratedAITool[],
  maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): GeneratedAITool[] {
  const maxLevel = RISK_LEVEL_ORDER[maxRiskLevel];
  return tools.filter(tool => {
    const toolLevel = RISK_LEVEL_ORDER[tool.metadata.risk.level];
    return toolLevel <= maxLevel;
  });
}

/**
 * Infer scopes from conversation context
 */
export function inferScopesFromContext(contextHints: string[]): string[] {
  const scopes = new Set<string>();

  for (const hint of contextHints) {
    const lowerHint = hint.toLowerCase();

    // Check for entity mentions
    if (lowerHint.includes('customer')) scopes.add('customers');
    if (lowerHint.includes('vendor') || lowerHint.includes('supplier')) scopes.add('vendors');
    if (lowerHint.includes('employee') || lowerHint.includes('staff')) scopes.add('employees');
    if (lowerHint.includes('lead') || lowerHint.includes('prospect')) scopes.add('leads');
    if (lowerHint.includes('invoice') || lowerHint.includes('bill')) scopes.add('invoices');
    if (lowerHint.includes('payment')) scopes.add('payments');
    if (lowerHint.includes('journal') || lowerHint.includes('entry')) scopes.add('journal');
    if (lowerHint.includes('report') || lowerHint.includes('balance') || lowerHint.includes('income')) {
      scopes.add('reporting');
    }
    if (lowerHint.includes('inventory') || lowerHint.includes('stock')) scopes.add('inventory');
    if (lowerHint.includes('account') || lowerHint.includes('chart')) scopes.add('accounts');
    if (lowerHint.includes('project') || lowerHint.includes('budget')) scopes.add('construction');
  }

  return Array.from(scopes);
}

/**
 * Get scoped tools based on context
 *
 * This is the main function for dynamic tool scoping. It considers:
 * - User role and permissions
 * - Active features
 * - Conversation context
 * - Risk level limits
 */
export function getScopedTools(context: ScopingContext): ScopingResult {
  const appliedScopes: string[] = [];
  let reason = '';

  // Start with role-based tools
  let tools = getToolsForRole(context.userRole);
  appliedScopes.push(`role:${context.userRole}`);
  reason = `Initial selection based on ${context.userRole} role`;

  const totalAvailable = tools.length;

  // Filter by permissions
  if (context.permissions.length > 0) {
    tools = filterByPermissions(tools, context.permissions);
    appliedScopes.push('permissions');
    reason += '; filtered by permissions';
  }

  // Filter by minimum role
  tools = filterByMinimumRole(tools, context.userRole);

  // Apply feature scopes if specified
  if (context.activeFeatures && context.activeFeatures.length > 0) {
    const featureScopes = context.activeFeatures.flatMap(
      feature => SCOPE_BUNDLES[feature] || []
    );
    if (featureScopes.length > 0) {
      const featureTools = getToolsByScope(featureScopes);
      // Intersect with current tools
      const featureToolNames = new Set(featureTools.map(t => t.metadata.name));
      tools = tools.filter(t => featureToolNames.has(t.metadata.name));
      appliedScopes.push(...context.activeFeatures.map(f => `feature:${f}`));
      reason += `; scoped to features: ${context.activeFeatures.join(', ')}`;
    }
  }

  // Apply context hints if specified
  if (context.contextHints && context.contextHints.length > 0) {
    const inferredScopes = inferScopesFromContext(context.contextHints);
    if (inferredScopes.length > 0) {
      const contextTools = getToolsByScope(inferredScopes);
      // Union with current tools (context hints expand, not restrict)
      const currentNames = new Set(tools.map(t => t.metadata.name));
      for (const tool of contextTools) {
        if (!currentNames.has(tool.metadata.name) && roleAtLeast(context.userRole, tool.metadata.permissions.minimumRole)) {
          tools.push(tool);
        }
      }
      appliedScopes.push(...inferredScopes.map(s => `context:${s}`));
      reason += `; expanded by context: ${inferredScopes.join(', ')}`;
    }
  }

  // Apply risk level filter
  if (context.maxRiskLevel) {
    tools = filterByRiskLevel(tools, context.maxRiskLevel);
    appliedScopes.push(`risk:${context.maxRiskLevel}`);
    reason += `; limited to ${context.maxRiskLevel} risk`;
  }

  // Apply max tools limit
  if (context.maxTools && tools.length > context.maxTools) {
    // Prioritize by: enabled > stability > risk level (lower is better)
    tools.sort((a, b) => {
      // Prefer stable tools
      if (a.metadata.stability !== b.metadata.stability) {
        const stabilityOrder = { stable: 0, beta: 1, experimental: 2 };
        return stabilityOrder[a.metadata.stability] - stabilityOrder[b.metadata.stability];
      }
      // Then prefer lower risk
      return RISK_LEVEL_ORDER[a.metadata.risk.level] - RISK_LEVEL_ORDER[b.metadata.risk.level];
    });
    tools = tools.slice(0, context.maxTools);
    appliedScopes.push(`limit:${context.maxTools}`);
    reason += `; limited to top ${context.maxTools} tools`;
  }

  return {
    tools,
    appliedScopes,
    reason,
    totalAvailable,
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get minimal tool set for a specific task
 */
export function getToolsForTask(
  taskType: 'create' | 'read' | 'update' | 'delete' | 'report',
  entityType: string,
  userRole: ExtendedUserRole
): GeneratedAITool[] {
  const scopes = [entityType];
  const tools = getToolsByScope(scopes);

  // Filter by operation type
  const operationPatterns: Record<string, RegExp> = {
    create: /^create_/,
    read: /^(list_|get_)/,
    update: /^update_/,
    delete: /^delete_/,
    report: /^generate_|_report$/,
  };

  const pattern = operationPatterns[taskType];
  const filteredTools = tools.filter(t => pattern.test(t.metadata.name));

  // Filter by role
  return filterByMinimumRole(filteredTools, userRole);
}

/**
 * Get all read-only tools (safe for any user)
 */
export function getReadOnlyTools(): GeneratedAITool[] {
  return AI_TOOLS.filter(
    t => t.metadata.enabled &&
      t.metadata.risk.level === 'LOW' &&
      t.metadata.method === 'GET'
  );
}

/**
 * Get tools requiring confirmation
 */
export function getConfirmationRequiredTools(): GeneratedAITool[] {
  return AI_TOOLS.filter(
    t => t.metadata.enabled && t.metadata.risk.requiresConfirmation
  );
}
