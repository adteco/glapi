/**
 * Accounting dimension types
 *
 * This module contains type definitions for accounting dimensions:
 * classes, departments, locations, subsidiaries, and chart of accounts.
 */

import { z } from 'zod';
import { uuidSchema, metadataSchema } from '../common';

// ============================================================================
// Base Accounting Dimension Schema
// ============================================================================

/**
 * Base schema for accounting dimensions with common fields
 */
const accountingDimensionBaseSchema = z.object({
  id: uuidSchema.optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  subsidiaryId: uuidSchema,
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// ============================================================================
// Department
// ============================================================================

/**
 * Department schema for organizational units
 */
export const departmentSchema = accountingDimensionBaseSchema.extend({});

export type Department = z.infer<typeof departmentSchema>;

/**
 * Schema for creating a department
 */
export const createDepartmentSchema = departmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

/**
 * Schema for updating a department
 */
export const updateDepartmentSchema = createDepartmentSchema
  .omit({ organizationId: true })
  .partial();

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ============================================================================
// Location
// ============================================================================

/**
 * Location schema with address fields
 */
export const locationSchema = accountingDimensionBaseSchema.extend({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).optional(), // ISO-2 country code
});

export type Location = z.infer<typeof locationSchema>;

/**
 * Schema for creating a location
 */
export const createLocationSchema = locationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/**
 * Schema for updating a location
 */
export const updateLocationSchema = createLocationSchema
  .omit({ organizationId: true })
  .partial();

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

// ============================================================================
// Class
// ============================================================================

/**
 * Class schema for transaction classification
 */
export const classSchema = accountingDimensionBaseSchema.extend({});

export type Class = z.infer<typeof classSchema>;

/**
 * Schema for creating a class
 */
export const createClassSchema = classSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

/**
 * Schema for updating a class
 */
export const updateClassSchema = createClassSchema
  .omit({ organizationId: true })
  .partial();

export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ============================================================================
// Subsidiary
// ============================================================================

/**
 * Subsidiary schema for legal entities within an organization
 */
export const subsidiarySchema = z.object({
  id: uuidSchema.optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  parentId: uuidSchema.optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Subsidiary = z.infer<typeof subsidiarySchema>;

/**
 * Schema for creating a subsidiary
 */
export const createSubsidiarySchema = subsidiarySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSubsidiaryInput = z.infer<typeof createSubsidiarySchema>;

/**
 * Schema for updating a subsidiary
 */
export const updateSubsidiarySchema = createSubsidiarySchema
  .omit({ organizationId: true })
  .partial();

export type UpdateSubsidiaryInput = z.infer<typeof updateSubsidiarySchema>;

// ============================================================================
// Chart of Accounts
// ============================================================================

/**
 * Account category enum matching database schema
 */
export const AccountCategoryEnum = z.enum([
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'COGS',
  'Expense',
]);

export type AccountCategory = z.infer<typeof AccountCategoryEnum>;

/**
 * Account schema for chart of accounts
 */
export const accountSchema = z.object({
  id: uuidSchema,
  organizationId: z.string(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: AccountCategoryEnum,
  accountSubcategory: z.string().optional().nullable(),
  normalBalance: z.string().optional().nullable(),
  financialStatementLine: z.string().optional().nullable(),
  isControlAccount: z.boolean().default(false),
  rollupAccountId: uuidSchema.optional().nullable(),
  gaapClassification: z.string().optional().nullable(),
  cashFlowCategory: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Account = z.infer<typeof accountSchema>;

/**
 * Schema for creating an account
 */
export const createAccountSchema = z.object({
  organizationId: z.string(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: AccountCategoryEnum,
  accountSubcategory: z.string().optional().nullable(),
  normalBalance: z.string().optional().nullable(),
  financialStatementLine: z.string().optional().nullable(),
  isControlAccount: z.boolean().optional().default(false),
  rollupAccountId: uuidSchema.optional().nullable(),
  gaapClassification: z.string().optional().nullable(),
  cashFlowCategory: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * Schema for updating an account
 */
export const updateAccountSchema = createAccountSchema.partial().omit({ organizationId: true });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * Schema for new account input (API requests without organizationId)
 */
export const newAccountSchema = createAccountSchema.omit({ organizationId: true });

export type NewAccountInput = z.infer<typeof newAccountSchema>;

/**
 * Schema for seeding accounts
 */
export const seedAccountSchema = z.object({
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: AccountCategoryEnum,
  description: z.string().max(1000).optional().nullable(),
  isControlAccount: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type SeedAccountInput = z.infer<typeof seedAccountSchema>;

/**
 * Account filters for querying
 */
export interface AccountFilters {
  accountCategory?: AccountCategory;
  isActive?: boolean;
  isControlAccount?: boolean;
  accountSubcategory?: string;
  cashFlowCategory?: string;
}
