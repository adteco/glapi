import { z } from 'zod';

/**
 * Cost code type values matching the database schema
 */
export const CostCodeTypeEnum = z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER']);
export type CostCodeType = z.infer<typeof CostCodeTypeEnum>;

/**
 * Full project cost code schema
 */
export const projectCostCodeSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentCostCodeId: z.string().uuid().nullable().optional(),
  activityCodeId: z.string().uuid().nullable().optional(),
  costCode: z.string().min(1),
  costType: CostCodeTypeEnum,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isBillable: z.boolean().default(true),
  // Amounts
  budgetAmount: z.string(),
  committedAmount: z.string(),
  actualAmount: z.string(),
  // GL Account references
  revenueAccountId: z.string().uuid().nullable().optional(),
  costAccountId: z.string().uuid().nullable().optional(),
  wipAccountId: z.string().uuid().nullable().optional(),
  // Metadata
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectCostCode = z.infer<typeof projectCostCodeSchema>;

/**
 * Schema for creating a new cost code
 */
export const createCostCodeSchema = z.object({
  projectId: z.string().uuid(),
  parentCostCodeId: z.string().uuid().optional(),
  activityCodeId: z.string().uuid().optional(),
  costCode: z.string().min(1, 'Cost code is required').max(50, 'Cost code must be 50 characters or less'),
  costType: CostCodeTypeEnum,
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isBillable: z.boolean().default(true),
  revenueAccountId: z.string().uuid().optional(),
  costAccountId: z.string().uuid().optional(),
  wipAccountId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateCostCodeInput = z.infer<typeof createCostCodeSchema>;

/**
 * Schema for updating a cost code
 */
export const updateCostCodeSchema = z.object({
  costCode: z.string().min(1).max(50).optional(),
  costType: CostCodeTypeEnum.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  parentCostCodeId: z.string().uuid().nullable().optional(),
  activityCodeId: z.string().uuid().nullable().optional(),
  revenueAccountId: z.string().uuid().nullable().optional(),
  costAccountId: z.string().uuid().nullable().optional(),
  wipAccountId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type UpdateCostCodeInput = z.infer<typeof updateCostCodeSchema>;

/**
 * Schema for cost code filters
 */
export const costCodeFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  costType: z.union([CostCodeTypeEnum, z.array(CostCodeTypeEnum)]).optional(),
  isActive: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  parentCostCodeId: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
});

export type CostCodeFilters = z.infer<typeof costCodeFiltersSchema>;

/**
 * Cost code with children for tree structure
 */
export interface CostCodeTreeNode extends ProjectCostCode {
  children: CostCodeTreeNode[];
}

/**
 * Cost code summary by type
 */
export interface CostCodeTypeSummary {
  costType: CostCodeType;
  count: number;
  totalBudget: string;
  totalCommitted: string;
  totalActual: string;
}

/**
 * Bulk import cost code row
 */
export const importCostCodeRowSchema = z.object({
  costCode: z.string().min(1),
  parentCostCode: z.string().optional(), // Reference by code
  costType: CostCodeTypeEnum,
  name: z.string().min(1),
  description: z.string().optional(),
  isBillable: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true' || v === '1')]).default(true),
});

export type ImportCostCodeRow = z.infer<typeof importCostCodeRowSchema>;

/**
 * Bulk import result
 */
export interface CostCodeImportResult {
  success: boolean;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    row: number;
    costCode: string;
    error: string;
  }>;
}
