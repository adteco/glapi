import { z } from 'zod';

export const projectExpenseStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED']);
export const projectExpenseTypeEnum = z.enum(['TRAVEL', 'MATERIALS', 'SUBCONTRACT', 'EQUIPMENT', 'OTHER']);

export const projectExpenseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  subsidiaryId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  projectTaskId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  expenseType: projectExpenseTypeEnum,
  vendorName: z.string().nullable().optional(),
  vendorInvoiceNumber: z.string().nullable().optional(),
  expenseDate: z.string(),
  amount: z.string(),
  currencyCode: z.string(),
  description: z.string().nullable().optional(),
  isBillable: z.boolean(),
  status: projectExpenseStatusEnum,
  submittedAt: z.date().nullable().optional(),
  submittedBy: z.string().uuid().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  rejectedAt: z.date().nullable().optional(),
  rejectedBy: z.string().uuid().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  postedAt: z.date().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectExpenseEntry = z.infer<typeof projectExpenseSchema>;

export const createProjectExpenseSchema = z.object({
  projectId: z.string().uuid().optional(),
  projectTaskId: z.string().uuid().optional(),
  costCodeId: z.string().uuid(),
  expenseType: projectExpenseTypeEnum.default('OTHER'),
  vendorName: z.string().optional(),
  vendorInvoiceNumber: z.string().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currencyCode: z.string().default('USD').optional(),
  description: z.string().optional(),
  isBillable: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;

export const updateProjectExpenseSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  projectTaskId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  expenseType: projectExpenseTypeEnum.optional(),
  vendorName: z.string().nullable().optional(),
  vendorInvoiceNumber: z.string().nullable().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currencyCode: z.string().optional(),
  description: z.string().nullable().optional(),
  isBillable: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type UpdateProjectExpenseInput = z.infer<typeof updateProjectExpenseSchema>;

export const projectExpenseFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  projectTaskId: z.string().uuid().optional(),
  status: z.union([projectExpenseStatusEnum, z.array(projectExpenseStatusEnum)]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ProjectExpenseFilters = z.infer<typeof projectExpenseFiltersSchema>;

export const expenseAttachmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  expenseId: z.string().uuid(),
  fileName: z.string(),
  fileUrl: z.string(),
  contentType: z.string().nullable().optional(),
  fileSize: z.number().nullable().optional(),
  uploadedBy: z.string().uuid().nullable().optional(),
  uploadedAt: z.date(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type ProjectExpenseAttachment = z.infer<typeof expenseAttachmentSchema>;

export const createExpenseAttachmentSchema = z.object({
  expenseId: z.string().uuid(),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  contentType: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateExpenseAttachmentInput = z.infer<typeof createExpenseAttachmentSchema>;

export interface ProjectExpensePostingResult {
  success: boolean;
  postedCount: number;
  failedCount: number;
  glTransactionId?: string;
  glTransactionIds?: string[];
  errors: Array<{
    expenseId: string;
    error: string;
  }>;
}
