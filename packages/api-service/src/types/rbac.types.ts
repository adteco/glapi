import { z } from 'zod';

// ============ Resource Types ============

/**
 * All resource types that can have permissions assigned
 */
export const ResourceTypes = {
  // Accounting Dimensions
  ACCOUNT: 'ACCOUNT',
  CLASS: 'CLASS',
  DEPARTMENT: 'DEPARTMENT',
  LOCATION: 'LOCATION',
  SUBSIDIARY: 'SUBSIDIARY',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  ITEM: 'ITEM',
  PROJECT: 'PROJECT',

  // GL & Transactions
  GL_TRANSACTION: 'GL_TRANSACTION',
  GL_ACCOUNT_BALANCE: 'GL_ACCOUNT_BALANCE',
  BUSINESS_TRANSACTION: 'BUSINESS_TRANSACTION',
  JOURNAL_ENTRY: 'JOURNAL_ENTRY',
  POSTING_RULE: 'POSTING_RULE',

  // Accounting Periods
  ACCOUNTING_PERIOD: 'ACCOUNTING_PERIOD',

  // Revenue Recognition
  CONTRACT: 'CONTRACT',
  PERFORMANCE_OBLIGATION: 'PERFORMANCE_OBLIGATION',
  REVENUE_SCHEDULE: 'REVENUE_SCHEDULE',

  // Subscriptions & Billing
  SUBSCRIPTION: 'SUBSCRIPTION',
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  CREDIT_MEMO: 'CREDIT_MEMO',

  // Administration
  USER: 'USER',
  ROLE: 'ROLE',
  PERMISSION: 'PERMISSION',
  ORGANIZATION: 'ORGANIZATION',
  AUDIT_LOG: 'AUDIT_LOG',

  // Reports
  FINANCIAL_REPORT: 'FINANCIAL_REPORT',
  TRIAL_BALANCE: 'TRIAL_BALANCE',
  INCOME_STATEMENT: 'INCOME_STATEMENT',
  BALANCE_SHEET: 'BALANCE_SHEET',
} as const;

export type ResourceType = (typeof ResourceTypes)[keyof typeof ResourceTypes];

// ============ Actions ============

/**
 * All actions that can be performed on resources
 */
export const Actions = {
  // Basic CRUD
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',

  // GL-specific actions
  POST: 'POST',
  REVERSE: 'REVERSE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',

  // Period management
  OPEN: 'OPEN',
  CLOSE: 'CLOSE',
  LOCK: 'LOCK',

  // Administrative
  MANAGE: 'MANAGE',
  ASSIGN: 'ASSIGN',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

// ============ Access Levels ============

export const AccessLevels = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
} as const;

export type AccessLevel = (typeof AccessLevels)[keyof typeof AccessLevels];

// ============ Permission Check Types ============

export interface PermissionCheck {
  resourceType: ResourceType;
  action: Action;
  subsidiaryId?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  missingPermission?: string;
}

// ============ Role Types ============

export interface Role {
  id: string;
  roleName: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  createdDate: Date;
}

export interface Permission {
  id: string;
  permissionName: string;
  resourceType: string | null;
  action: string | null;
  description: string | null;
  createdDate: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  subsidiaryId: string | null;
  grantedBy: string | null;
  grantedDate: Date;
  expiresDate: Date | null;
  role?: Role;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserPermissionSummary {
  userId: string;
  roles: UserRole[];
  permissions: Permission[];
  subsidiaryAccess: {
    subsidiaryId: string;
    accessLevel: AccessLevel;
  }[];
}

// ============ Zod Schemas for Validation ============

export const ResourceTypeSchema = z.enum([
  'ACCOUNT',
  'CLASS',
  'DEPARTMENT',
  'LOCATION',
  'SUBSIDIARY',
  'CUSTOMER',
  'VENDOR',
  'ITEM',
  'PROJECT',
  'GL_TRANSACTION',
  'GL_ACCOUNT_BALANCE',
  'BUSINESS_TRANSACTION',
  'JOURNAL_ENTRY',
  'POSTING_RULE',
  'ACCOUNTING_PERIOD',
  'CONTRACT',
  'PERFORMANCE_OBLIGATION',
  'REVENUE_SCHEDULE',
  'SUBSCRIPTION',
  'INVOICE',
  'PAYMENT',
  'CREDIT_MEMO',
  'USER',
  'ROLE',
  'PERMISSION',
  'ORGANIZATION',
  'AUDIT_LOG',
  'FINANCIAL_REPORT',
  'TRIAL_BALANCE',
  'INCOME_STATEMENT',
  'BALANCE_SHEET',
]);

export const ActionSchema = z.enum([
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'POST',
  'REVERSE',
  'APPROVE',
  'REJECT',
  'OPEN',
  'CLOSE',
  'LOCK',
  'MANAGE',
  'ASSIGN',
  'EXPORT',
  'IMPORT',
]);

export const AccessLevelSchema = z.enum(['read', 'write', 'admin']);

export const CreateRoleSchema = z.object({
  roleName: z.string().min(1).max(100),
  roleDescription: z.string().max(500).optional(),
  isSystemRole: z.boolean().optional().default(false),
});

export const UpdateRoleSchema = z.object({
  roleName: z.string().min(1).max(100).optional(),
  roleDescription: z.string().max(500).nullable().optional(),
});

export const CreatePermissionSchema = z.object({
  permissionName: z.string().min(1).max(100),
  resourceType: ResourceTypeSchema,
  action: ActionSchema,
  description: z.string().max(500).optional(),
});

export const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  subsidiaryId: z.string().uuid().optional(),
  expiresDate: z.date().optional(),
});

export const RevokeRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  subsidiaryId: z.string().uuid().optional(),
});

export const GrantSubsidiaryAccessSchema = z.object({
  userId: z.string().uuid(),
  subsidiaryId: z.string().uuid(),
  accessLevel: AccessLevelSchema,
  expiresDate: z.date().optional(),
});

export const PermissionCheckSchema = z.object({
  resourceType: ResourceTypeSchema,
  action: ActionSchema,
  subsidiaryId: z.string().uuid().optional(),
});

// ============ Input Types (derived from Zod schemas) ============

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type CreatePermissionInput = z.infer<typeof CreatePermissionSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
export type RevokeRoleInput = z.infer<typeof RevokeRoleSchema>;
export type GrantSubsidiaryAccessInput = z.infer<typeof GrantSubsidiaryAccessSchema>;
export type PermissionCheckInput = z.infer<typeof PermissionCheckSchema>;

// ============ Default Role Definitions ============

/**
 * Pre-defined system roles with their default permissions
 */
export const DefaultRoles = {
  ADMIN: {
    name: 'ADMIN',
    description: 'Full administrative access to all resources',
    isSystemRole: true,
  },
  GL_MANAGER: {
    name: 'GL_MANAGER',
    description: 'Manage GL transactions, posting, and approvals',
    isSystemRole: true,
  },
  GL_VIEWER: {
    name: 'GL_VIEWER',
    description: 'Read-only access to GL data and reports',
    isSystemRole: true,
  },
  AP_CLERK: {
    name: 'AP_CLERK',
    description: 'Create and manage accounts payable transactions',
    isSystemRole: true,
  },
  AR_CLERK: {
    name: 'AR_CLERK',
    description: 'Create and manage accounts receivable transactions',
    isSystemRole: true,
  },
  AUDITOR: {
    name: 'AUDITOR',
    description: 'Read-only access to all data including audit logs',
    isSystemRole: true,
  },
} as const;

/**
 * Generate a permission name from resource type and action
 */
export function generatePermissionName(resourceType: ResourceType, action: Action): string {
  return `${resourceType}:${action}`;
}

/**
 * Parse a permission name into resource type and action
 */
export function parsePermissionName(permissionName: string): { resourceType: string; action: string } | null {
  const parts = permissionName.split(':');
  if (parts.length !== 2) return null;
  return { resourceType: parts[0], action: parts[1] };
}
