import { z } from 'zod';
import { CostCodeTypeEnum } from './project-cost-codes.types';

/**
 * Budget version status values matching the database schema
 */
export const BudgetVersionStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED', 'SUPERSEDED']);
export type BudgetVersionStatus = z.infer<typeof BudgetVersionStatusEnum>;

/**
 * Import source types
 */
export const ImportSourceEnum = z.enum(['CSV', 'API', 'MANUAL']);
export type ImportSource = z.infer<typeof ImportSourceEnum>;

/**
 * Full budget version schema
 */
export const projectBudgetVersionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  versionName: z.string().min(1),
  status: BudgetVersionStatusEnum,
  isCurrent: z.boolean(),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Totals
  totalBudgetAmount: z.string(),
  totalLaborAmount: z.string(),
  totalMaterialAmount: z.string(),
  totalEquipmentAmount: z.string(),
  totalSubcontractAmount: z.string(),
  totalOtherAmount: z.string(),
  // Workflow tracking
  createdBy: z.string().uuid().nullable().optional(),
  submittedBy: z.string().uuid().nullable().optional(),
  submittedDate: z.date().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  approvedDate: z.date().nullable().optional(),
  lockedBy: z.string().uuid().nullable().optional(),
  lockedDate: z.date().nullable().optional(),
  // Import tracking
  importSource: ImportSourceEnum.nullable().optional(),
  importFileName: z.string().nullable().optional(),
  importDate: z.date().nullable().optional(),
  // Metadata
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectBudgetVersion = z.infer<typeof projectBudgetVersionSchema>;

/**
 * Full budget line schema
 */
export const projectBudgetLineSchema = z.object({
  id: z.string().uuid(),
  budgetVersionId: z.string().uuid(),
  projectCostCodeId: z.string().uuid(),
  lineNumber: z.number().int().positive(),
  description: z.string().nullable().optional(),
  // Budget amounts
  originalBudgetAmount: z.string(),
  revisedBudgetAmount: z.string(),
  approvedChanges: z.string(),
  pendingChanges: z.string(),
  // Tracking amounts
  committedAmount: z.string(),
  actualAmount: z.string(),
  encumberedAmount: z.string(),
  // Forecasting
  forecastAmount: z.string(),
  estimateToComplete: z.string(),
  estimateAtCompletion: z.string(),
  // Variance
  varianceAmount: z.string(),
  variancePercent: z.string().nullable().optional(),
  // Units
  budgetUnits: z.string().nullable().optional(),
  actualUnits: z.string().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  unitRate: z.string().nullable().optional(),
  // Notes and metadata
  notes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectBudgetLine = z.infer<typeof projectBudgetLineSchema>;

/**
 * Schema for creating a new budget version
 */
export const createBudgetVersionSchema = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().min(1, 'Version name is required').max(100),
  description: z.string().max(500).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD format').optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>;

/**
 * Schema for updating a budget version
 */
export const updateBudgetVersionSchema = z.object({
  versionName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>;

/**
 * Schema for updating budget version status
 */
export const updateBudgetVersionStatusSchema = z.object({
  status: BudgetVersionStatusEnum,
});

export type UpdateBudgetVersionStatusInput = z.infer<typeof updateBudgetVersionStatusSchema>;

/**
 * Valid budget version status transitions
 */
export const VALID_BUDGET_STATUS_TRANSITIONS: Record<BudgetVersionStatus, BudgetVersionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['DRAFT', 'APPROVED'], // Can be rejected back to DRAFT
  APPROVED: ['LOCKED', 'SUPERSEDED'],
  LOCKED: ['SUPERSEDED'], // Can only be superseded by new version
  SUPERSEDED: [], // Terminal state
};

/**
 * Schema for creating a budget line
 */
export const createBudgetLineSchema = z.object({
  projectCostCodeId: z.string().uuid(),
  description: z.string().max(500).optional(),
  originalBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  budgetUnits: z.string().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  unitRate: z.string().regex(/^-?\d+(\.\d{1,6})?$/, 'Invalid rate format').optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>;

/**
 * Schema for updating a budget line
 */
export const updateBudgetLineSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  originalBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  revisedBudgetAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  approvedChanges: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  pendingChanges: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  forecastAmount: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  estimateToComplete: z.string().regex(/^-?\d+(\.\d{1,4})?$/).optional(),
  budgetUnits: z.string().nullable().optional(),
  actualUnits: z.string().nullable().optional(),
  unitOfMeasure: z.string().max(50).nullable().optional(),
  unitRate: z.string().regex(/^-?\d+(\.\d{1,6})?$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>;

/**
 * Schema for budget version filters
 */
export const budgetVersionFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.union([BudgetVersionStatusEnum, z.array(BudgetVersionStatusEnum)]).optional(),
  isCurrent: z.boolean().optional(),
});

export type BudgetVersionFilters = z.infer<typeof budgetVersionFiltersSchema>;

/**
 * Budget line with cost code details
 */
export interface BudgetLineWithCostCode extends ProjectBudgetLine {
  costCode: {
    id: string;
    costCode: string;
    name: string;
    costType: string;
  };
}

/**
 * Variance summary by cost type
 */
export interface BudgetVarianceSummary {
  costType: string;
  totalBudget: string;
  totalActual: string;
  totalCommitted: string;
  totalVariance: string;
  variancePercent: number;
}

/**
 * CSV import row schema
 */
export const importBudgetRowSchema = z.object({
  costCode: z.string().min(1),
  description: z.string().optional(),
  budgetAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  budgetUnits: z.union([z.string(), z.number()]).optional().transform((v) => v ? String(v) : undefined),
  unitOfMeasure: z.string().optional(),
  unitRate: z.union([z.string(), z.number()]).optional().transform((v) => v ? String(v) : undefined),
  notes: z.string().optional(),
});

export type ImportBudgetRow = z.infer<typeof importBudgetRowSchema>;

/**
 * CSV import options
 */
export const budgetImportOptionsSchema = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().optional(),
  skipInvalidRows: z.boolean().default(false),
  createMissingCostCodes: z.boolean().default(false),
});

export type BudgetImportOptions = z.infer<typeof budgetImportOptionsSchema>;

/**
 * CSV import result
 */
export interface BudgetImportResult {
  success: boolean;
  versionId: string | null;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    row: number;
    costCode: string;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    costCode: string;
    warning: string;
  }>;
}

/**
 * Copy budget version options
 */
export const copyBudgetVersionSchema = z.object({
  sourceVersionId: z.string().uuid(),
  newVersionName: z.string().min(1).max(100),
});

export type CopyBudgetVersionInput = z.infer<typeof copyBudgetVersionSchema>;
