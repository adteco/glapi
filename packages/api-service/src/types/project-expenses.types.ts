import { z } from 'zod';

/**
 * Expense status values
 */
export const ExpenseStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'VOIDED']);
export type ExpenseStatus = z.infer<typeof ExpenseStatusEnum>;

/**
 * Expense category values matching cost types
 */
export const ExpenseCategoryEnum = z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER', 'OVERHEAD']);
export type ExpenseCategory = z.infer<typeof ExpenseCategoryEnum>;

/**
 * Project expense schema
 */
export const projectExpenseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid().nullable().optional(),
  expenseNumber: z.string(),
  description: z.string(),
  category: ExpenseCategoryEnum,
  amount: z.string(),
  quantity: z.string().nullable().optional(),
  unitPrice: z.string().nullable().optional(),
  expenseDate: z.string(),
  vendorId: z.string().uuid().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  status: ExpenseStatusEnum,
  notes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  approvedDate: z.date().nullable().optional(),
  postedDate: z.date().nullable().optional(),
  glTransactionId: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectExpense = z.infer<typeof projectExpenseSchema>;

/**
 * Create expense input schema
 */
export const createExpenseSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  category: ExpenseCategoryEnum,
  amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  quantity: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  unitPrice: z.string().regex(/^-?\d+(\.\d{1,6})?$/).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().max(255).optional(),
  invoiceNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Update expense input schema
 */
export const updateExpenseSchema = createExpenseSchema.partial().omit({ projectId: true });

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * Update expense status input schema
 */
export const updateExpenseStatusSchema = z.object({
  status: ExpenseStatusEnum,
  reason: z.string().max(500).optional(),
});

export type UpdateExpenseStatusInput = z.infer<typeof updateExpenseStatusSchema>;

/**
 * Valid expense status transitions
 */
export const VALID_EXPENSE_STATUS_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  DRAFT: ['SUBMITTED', 'VOIDED'],
  SUBMITTED: ['DRAFT', 'APPROVED', 'REJECTED'],
  APPROVED: ['POSTED', 'VOIDED'],
  REJECTED: ['DRAFT', 'VOIDED'],
  POSTED: ['VOIDED'],
  VOIDED: [],
};

/**
 * Expense filters schema
 */
export const expenseFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  category: ExpenseCategoryEnum.optional(),
  status: z.union([ExpenseStatusEnum, z.array(ExpenseStatusEnum)]).optional(),
  vendorId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

/**
 * Expense summary by category
 */
export interface ExpenseSummaryByCategory {
  category: ExpenseCategory;
  totalAmount: string;
  count: number;
}

/**
 * Expense summary by cost code
 */
export interface ExpenseSummaryByCostCode {
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  totalAmount: string;
  count: number;
}
