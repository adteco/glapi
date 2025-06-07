import { z } from 'zod';

// Account category enum matching database
export const AccountCategoryEnum = z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']);
export type AccountCategory = z.infer<typeof AccountCategoryEnum>;

// Account interface
export interface Account {
  id: string;
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: AccountCategory;
  accountSubcategory?: string | null;
  normalBalance?: string | null;
  financialStatementLine?: string | null;
  isControlAccount: boolean;
  rollupAccountId?: string | null;
  gaapClassification?: string | null;
  cashFlowCategory?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create account input schema
export const CreateAccountSchema = z.object({
  organizationId: z.string(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: AccountCategoryEnum,
  accountSubcategory: z.string().optional().nullable(),
  normalBalance: z.string().optional().nullable(),
  financialStatementLine: z.string().optional().nullable(),
  isControlAccount: z.boolean().optional().default(false),
  rollupAccountId: z.string().uuid().optional().nullable(),
  gaapClassification: z.string().optional().nullable(),
  cashFlowCategory: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

// Update account input schema
export const UpdateAccountSchema = CreateAccountSchema.partial().omit({ organizationId: true });
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

// New account schema (for API requests, without organizationId)
export const NewAccountSchema = CreateAccountSchema.omit({ organizationId: true });
export type NewAccountInput = z.infer<typeof NewAccountSchema>;

// Seed account schema (for seeding, with defaults)
export const SeedAccountSchema = z.object({
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountCategory: AccountCategoryEnum,
  description: z.string().max(1000).optional().nullable(),
  isControlAccount: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export type SeedAccountInput = z.infer<typeof SeedAccountSchema>;

// Account filters
export interface AccountFilters {
  accountCategory?: AccountCategory;
  isActive?: boolean;
  isControlAccount?: boolean;
  accountSubcategory?: string;
  cashFlowCategory?: string;
}