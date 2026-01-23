/**
 * Accounting Lists types
 *
 * This module contains type definitions for the accounting lists system,
 * including payment terms, payment methods, and charge types.
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Accounting list type enum
 */
export const AccountingListTypeEnum = z.enum([
  'payment_terms',
  'payment_method',
  'charge_type',
]);
export type AccountingListType = z.infer<typeof AccountingListTypeEnum>;

/**
 * Due date calculation type enum
 */
export const DueDateTypeEnum = z.enum([
  'net_days',       // Standard net days from invoice date
  'day_of_month',   // Due on specific day of month
  'end_of_month',   // Due at end of month + net days
]);
export type DueDateType = z.infer<typeof DueDateTypeEnum>;

/**
 * Payment method type enum
 */
export const PaymentMethodTypeEnum = z.enum([
  'cash',
  'check',
  'credit_card',
  'debit_card',
  'ach',
  'wire_transfer',
  'other',
]);
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeEnum>;

/**
 * Charge category enum
 */
export const ChargeCategoryEnum = z.enum([
  'service',
  'product',
  'shipping',
  'tax',
  'discount',
  'fee',
  'other',
]);
export type ChargeCategory = z.infer<typeof ChargeCategoryEnum>;

// ============================================================================
// PAYMENT TERMS SCHEMAS
// ============================================================================

/**
 * Schema for creating payment terms
 */
export const createPaymentTermsSchema = z.object({
  // Base accounting list fields
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),

  // Payment terms specific fields
  dueDateType: DueDateTypeEnum.default('net_days'),
  netDays: z.number().int().min(0).max(365).default(30),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  discountDays: z.number().int().min(0).max(365).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const updatePaymentTermsSchema = createPaymentTermsSchema.partial();

export type CreatePaymentTermsInput = z.infer<typeof createPaymentTermsSchema>;
export type UpdatePaymentTermsInput = z.infer<typeof updatePaymentTermsSchema>;

// ============================================================================
// PAYMENT METHODS SCHEMAS
// ============================================================================

/**
 * Schema for creating payment methods
 */
export const createPaymentMethodSchema = z.object({
  // Base accounting list fields
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),

  // Payment method specific fields
  methodType: PaymentMethodTypeEnum,
  depositAccountId: z.string().uuid().optional().nullable(),
  requiresApproval: z.boolean().default(false),
  processingFeePercent: z.number().min(0).max(100).optional().nullable(),
  processingFeeFixed: z.number().min(0).optional().nullable(),
});

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

// ============================================================================
// CHARGE TYPES SCHEMAS
// ============================================================================

/**
 * Schema for creating charge types
 */
export const createChargeTypeSchema = z.object({
  // Base accounting list fields
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),

  // Charge type specific fields
  chargeCategory: ChargeCategoryEnum,
  incomeAccountId: z.string().uuid().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  isTaxable: z.boolean().default(true),
  defaultTaxCodeId: z.string().uuid().optional().nullable(),
});

export const updateChargeTypeSchema = createChargeTypeSchema.partial();

export type CreateChargeTypeInput = z.infer<typeof createChargeTypeSchema>;
export type UpdateChargeTypeInput = z.infer<typeof updateChargeTypeSchema>;

// ============================================================================
// CUSTOMER ASSIGNMENT SCHEMAS
// ============================================================================

/**
 * Schema for assigning accounting list to customer
 */
export const assignCustomerAccountingListSchema = z.object({
  customerId: z.string().uuid(),
  accountingListId: z.string().uuid(),
  priority: z.number().int().min(1).default(1),
  effectiveDate: z.date().optional().nullable(),
  expirationDate: z.date().optional().nullable(),
});

export type AssignCustomerAccountingListInput = z.infer<typeof assignCustomerAccountingListSchema>;

// ============================================================================
// DUE DATE CALCULATION SCHEMAS
// ============================================================================

/**
 * Schema for due date calculation input
 */
export const calculateDueDateSchema = z.object({
  invoiceDate: z.date(),
  paymentTermsId: z.string().uuid(),
});

export type CalculateDueDateInput = z.infer<typeof calculateDueDateSchema>;

/**
 * Due date calculation result
 */
export interface DueDateCalculation {
  dueDate: Date;
  discountDate: Date | null;
  discountAmount: number | null;
  discountPercent: number;
  netDays: number;
  dueDateType: DueDateType;
}

/**
 * Schema for early payment discount calculation
 */
export const calculateDiscountSchema = z.object({
  amount: z.number().positive(),
  paymentTermsId: z.string().uuid(),
  invoiceDate: z.date(),
  paymentDate: z.date(),
});

export type CalculateDiscountInput = z.infer<typeof calculateDiscountSchema>;

/**
 * Early payment discount calculation result
 */
export interface DiscountCalculation {
  originalAmount: number;
  discountAmount: number;
  netAmount: number;
  discountApplied: boolean;
  discountPercent: number;
  discountDeadline: Date | null;
  daysUntilDeadline: number | null;
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Base accounting list interface
 */
export interface AccountingList {
  id: string;
  organizationId: string;
  listType: AccountingListType;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment terms interface
 */
export interface PaymentTerms extends AccountingList {
  listType: 'payment_terms';
  details: {
    id: string;
    dueDateType: DueDateType;
    netDays: number;
    dayOfMonth: number | null;
    discountDays: number;
    discountPercent: number;
  };
}

/**
 * Payment method interface
 */
export interface PaymentMethod extends AccountingList {
  listType: 'payment_method';
  details: {
    id: string;
    methodType: PaymentMethodType;
    depositAccountId: string | null;
    requiresApproval: boolean;
    processingFeePercent: number | null;
    processingFeeFixed: number | null;
    depositAccount?: {
      id: string;
      code: string;
      name: string;
    };
  };
}

/**
 * Charge type interface
 */
export interface ChargeType extends AccountingList {
  listType: 'charge_type';
  details: {
    id: string;
    chargeCategory: ChargeCategory;
    incomeAccountId: string | null;
    expenseAccountId: string | null;
    isTaxable: boolean;
    defaultTaxCodeId: string | null;
    incomeAccount?: {
      id: string;
      code: string;
      name: string;
    };
    expenseAccount?: {
      id: string;
      code: string;
      name: string;
    };
  };
}

/**
 * Customer accounting list assignment interface
 */
export interface CustomerAccountingList {
  id: string;
  customerId: string;
  accountingListId: string;
  priority: number;
  effectiveDate: string | null;
  expirationDate: string | null;
  createdAt: Date;
  accountingList?: AccountingList;
}

/**
 * Customer with assigned accounting lists
 */
export interface CustomerWithAccountingLists {
  customerId: string;
  paymentTerms: CustomerAccountingList[];
  paymentMethods: CustomerAccountingList[];
  chargeTypes: CustomerAccountingList[];
}

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing accounting lists
 */
export const accountingListQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
  activeOnly: z.boolean().optional(),
  search: z.string().optional(),
});

export type AccountingListQueryInput = z.infer<typeof accountingListQuerySchema>;

/**
 * Schema for getting customer's effective payment terms
 */
export const getEffectivePaymentTermsSchema = z.object({
  customerId: z.string().uuid(),
  asOfDate: z.date().optional(),
});

export type GetEffectivePaymentTermsInput = z.infer<typeof getEffectivePaymentTermsSchema>;
