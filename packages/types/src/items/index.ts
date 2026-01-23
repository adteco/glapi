/**
 * Items & Inventory types
 *
 * This module contains type definitions for items, inventory tracking,
 * pricing, vendor items, and assembly/kit components.
 */

import { z } from 'zod';

// ============================================================================
// Units of Measure
// ============================================================================

/**
 * Schema for creating a unit of measure
 */
export const createUnitsOfMeasureSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  abbreviation: z.string().min(1).max(10),
  baseUnitId: z.string().uuid().optional().nullable(),
  baseConversionFactor: z.number().positive().default(1),
  decimalPlaces: z.number().int().min(0).max(6).default(2),
});

export const updateUnitsOfMeasureSchema = createUnitsOfMeasureSchema.partial();

export type CreateUnitsOfMeasureInput = z.infer<typeof createUnitsOfMeasureSchema>;
export type UpdateUnitsOfMeasureInput = z.infer<typeof updateUnitsOfMeasureSchema>;

export interface UnitsOfMeasure {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  abbreviation: string;
  baseUnitId: string | null;
  baseConversionFactor: number;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Item Categories
// ============================================================================

/**
 * Schema for creating an item category
 */
export const createItemCategorySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  parentCategoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateItemCategorySchema = createItemCategorySchema.partial();

export type CreateItemCategoryInput = z.infer<typeof createItemCategorySchema>;
export type UpdateItemCategoryInput = z.infer<typeof updateItemCategorySchema>;

export interface ItemCategory {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
  level: number;
  path: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: ItemCategory[];
}

// ============================================================================
// Items
// ============================================================================

/**
 * Item type enum for different item classifications
 */
export const ItemTypeEnum = z.enum([
  'INVENTORY_ITEM',
  'NON_INVENTORY_ITEM',
  'SERVICE',
  'CHARGE',
  'DISCOUNT',
  'TAX',
  'ASSEMBLY',
  'KIT',
]);

export type ItemType = z.infer<typeof ItemTypeEnum>;

// Legacy alias
export const itemTypeEnum = ItemTypeEnum;

/**
 * Schema for creating an item
 */
export const createItemSchema = z.object({
  itemCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  itemType: ItemTypeEnum,
  isParent: z.boolean().default(false),
  parentItemId: z.string().uuid().optional().nullable(),
  variantAttributes: z.record(z.string()).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unitOfMeasureId: z.string().uuid(),
  incomeAccountId: z.string().uuid().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  assetAccountId: z.string().uuid().optional().nullable(),
  cogsAccountId: z.string().uuid().optional().nullable(),
  defaultPrice: z.number().nonnegative().optional(),
  defaultCost: z.number().nonnegative().optional(),
  isTaxable: z.boolean().default(true),
  taxCode: z.string().optional(),
  isActive: z.boolean().default(true),
  isPurchasable: z.boolean().default(true),
  isSaleable: z.boolean().default(true),
  trackQuantity: z.boolean().default(false),
  trackLotNumbers: z.boolean().default(false),
  trackSerialNumbers: z.boolean().default(false),
  sku: z.string().optional(),
  upc: z.string().optional(),
  manufacturerPartNumber: z.string().optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
});

export const updateItemSchema = createItemSchema.partial();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Schema for variant attributes
 */
export const variantAttributeSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
});

export const generateVariantsSchema = z.object({
  parentItemId: z.string().uuid(),
  attributes: z.array(variantAttributeSchema).min(1),
});

export type VariantAttribute = z.infer<typeof variantAttributeSchema>;
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;

export interface Item {
  id: string;
  organizationId: string;
  itemCode: string;
  name: string;
  description?: string;
  itemType: string;
  isParent: boolean;
  parentItemId: string | null;
  variantAttributes?: Record<string, string>;
  categoryId: string | null;
  unitOfMeasureId: string;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  assetAccountId: string | null;
  cogsAccountId: string | null;
  defaultPrice: number | null;
  defaultCost: number | null;
  isTaxable: boolean;
  taxCode: string | null;
  isActive: boolean;
  isPurchasable: boolean;
  isSaleable: boolean;
  trackQuantity: boolean;
  trackLotNumbers: boolean;
  trackSerialNumbers: boolean;
  sku: string | null;
  upc: string | null;
  manufacturerPartNumber: string | null;
  weight: number | null;
  weightUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Price Lists & Pricing
// ============================================================================

/**
 * Schema for creating a price list
 */
export const createPriceListSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  currencyCode: z.string().default('USD'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updatePriceListSchema = createPriceListSchema.partial();

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;

export interface PriceList {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  currencyCode: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for creating item pricing
 */
export const createItemPricingSchema = z.object({
  itemId: z.string().uuid(),
  priceListId: z.string().uuid(),
  unitPrice: z.number().positive(),
  minQuantity: z.number().positive().default(1),
  effectiveDate: z.string().transform((str) => new Date(str)),
  expirationDate: z
    .string()
    .transform((str) => new Date(str))
    .optional()
    .nullable(),
});

export const updateItemPricingSchema = createItemPricingSchema.partial();

export type CreateItemPricingInput = z.infer<typeof createItemPricingSchema>;
export type UpdateItemPricingInput = z.infer<typeof updateItemPricingSchema>;

export interface ItemPricing {
  id: string;
  itemId: string;
  priceListId: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: Date;
  expirationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemPricingWithItem extends ItemPricing {
  item?: {
    id: string;
    itemCode: string;
    name: string;
    description?: string;
    defaultPrice?: number;
    isActive: boolean;
  };
}

/**
 * Schema for assigning price lists to customers
 */
export const assignCustomerPriceListSchema = z.object({
  customerId: z.string().uuid(),
  priceListId: z.string().uuid(),
  priority: z.number().int().positive().default(1),
  effectiveDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  expirationDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
});

export type AssignCustomerPriceListInput = z.infer<typeof assignCustomerPriceListSchema>;

/**
 * Schema for price calculation requests
 */
export const priceCalculationSchema = z.object({
  itemId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  date: z
    .string()
    .transform((str) => new Date(str))
    .default(() => new Date().toISOString()),
});

export type PriceCalculationInput = z.infer<typeof priceCalculationSchema>;

export interface CalculatedPrice {
  unitPrice: number;
  priceListId: string;
  priceListName: string;
  minQuantity: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

// ============================================================================
// Price List Labor Rates (Rate Cards)
// ============================================================================

/**
 * Schema for creating labor rates in a price list
 */
export const createPriceListLaborRateSchema = z.object({
  priceListId: z.string().uuid(),
  // Rate targeting (all optional - more specific = higher priority)
  employeeId: z.string().uuid().optional().nullable(),
  laborRole: z.string().max(100).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  costCodeId: z.string().uuid().optional().nullable(),
  // Rate details
  laborRate: z.number().nonnegative(),
  burdenRate: z.number().nonnegative().default(0),
  billingRate: z.number().nonnegative(),
  // Multipliers
  overtimeMultiplier: z.number().positive().default(1.5),
  doubleTimeMultiplier: z.number().positive().default(2.0),
  // Selection
  priority: z.number().int().nonnegative().default(0),
  effectiveDate: z.string().transform((str) => new Date(str)),
  expirationDate: z
    .string()
    .transform((str) => new Date(str))
    .optional()
    .nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const updatePriceListLaborRateSchema = createPriceListLaborRateSchema.partial().omit({ priceListId: true });

export type CreatePriceListLaborRateInput = z.infer<typeof createPriceListLaborRateSchema>;
export type UpdatePriceListLaborRateInput = z.infer<typeof updatePriceListLaborRateSchema>;

export interface PriceListLaborRate {
  id: string;
  priceListId: string;
  employeeId: string | null;
  laborRole: string | null;
  projectId: string | null;
  costCodeId: string | null;
  laborRate: number;
  burdenRate: number;
  billingRate: number;
  overtimeMultiplier: number;
  doubleTimeMultiplier: number;
  priority: number;
  effectiveDate: string;
  expirationDate: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceListLaborRateWithRelations extends PriceListLaborRate {
  employee?: {
    id: string;
    displayName: string;
    email?: string;
  };
  project?: {
    id: string;
    name: string;
    projectCode: string;
  };
  costCode?: {
    id: string;
    costCode: string;
    name: string;
  };
}

/**
 * Schema for filtering labor rates
 */
export const laborRateFiltersSchema = z.object({
  priceListId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  laborRole: z.string().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  activeOnly: z.boolean().default(true),
});

export type LaborRateFilters = z.infer<typeof laborRateFiltersSchema>;

/**
 * Schema for billing rate calculation requests
 */
export const billingRateCalculationSchema = z.object({
  customerId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  laborRole: z.string().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  date: z
    .string()
    .transform((str) => new Date(str))
    .default(() => new Date().toISOString()),
});

export type BillingRateCalculationInput = z.infer<typeof billingRateCalculationSchema>;

export interface CalculatedBillingRate {
  laborRate: number;
  burdenRate: number;
  billingRate: number;
  overtimeMultiplier: number;
  doubleTimeMultiplier: number;
  priceListId: string;
  priceListName: string;
  laborRateId: string;
  effectiveDate: Date;
  expirationDate: Date | null;
  // Match info for debugging/audit
  matchedOn: {
    employee: boolean;
    laborRole: boolean;
    project: boolean;
    costCode: boolean;
  };
}

// ============================================================================
// Vendor Items
// ============================================================================

/**
 * Schema for creating vendor item relationships
 */
export const createVendorItemSchema = z.object({
  vendorId: z.string().uuid(),
  itemId: z.string().uuid(),
  vendorItemCode: z.string().optional(),
  vendorItemName: z.string().optional(),
  vendorUnitCost: z.number().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().default(0),
  minOrderQuantity: z.number().positive().default(1),
  isPreferred: z.boolean().default(false),
});

export const updateVendorItemSchema = createVendorItemSchema.partial();

export type CreateVendorItemInput = z.infer<typeof createVendorItemSchema>;
export type UpdateVendorItemInput = z.infer<typeof updateVendorItemSchema>;

export interface VendorItem {
  id: string;
  vendorId: string;
  itemId: string;
  vendorItemCode: string | null;
  vendorItemName: string | null;
  vendorUnitCost: number | null;
  leadTimeDays: number;
  minOrderQuantity: number;
  isPreferred: boolean;
  lastPurchaseDate: Date | null;
  lastPurchasePrice: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Inventory Tracking - Lot Numbers
// ============================================================================

/**
 * Lot status enum for inventory tracking
 */
export const LotStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'RECALLED']);
export type LotStatus = z.infer<typeof LotStatusEnum>;

// Legacy alias
export const lotStatusEnum = LotStatusEnum;

/**
 * Schema for creating lot numbers
 */
export const createLotNumberSchema = z.object({
  itemId: z.string().uuid(),
  lotNumber: z.string().min(1),
  manufactureDate: z.date().optional(),
  expirationDate: z.date().optional(),
  quantityReceived: z.number().positive(),
  quantityOnHand: z.number().nonnegative(),
  status: LotStatusEnum.default('ACTIVE'),
  notes: z.string().optional(),
});

export const updateLotNumberSchema = createLotNumberSchema.partial();

export type CreateLotNumberInput = z.infer<typeof createLotNumberSchema>;
export type UpdateLotNumberInput = z.infer<typeof updateLotNumberSchema>;

export interface LotNumber {
  id: string;
  organizationId: string;
  itemId: string;
  lotNumber: string;
  manufactureDate: Date | null;
  expirationDate: Date | null;
  quantityReceived: number;
  quantityOnHand: number;
  status: string;
  notes: string | null;
  createdAt: Date;
}

// ============================================================================
// Inventory Tracking - Serial Numbers
// ============================================================================

/**
 * Serial number status enum for inventory tracking
 */
export const SerialStatusEnum = z.enum([
  'AVAILABLE',
  'SOLD',
  'IN_TRANSIT',
  'RETURNED',
  'DAMAGED',
  'LOST',
]);
export type SerialStatus = z.infer<typeof SerialStatusEnum>;

// Legacy alias
export const serialStatusEnum = SerialStatusEnum;

/**
 * Schema for creating serial numbers
 */
export const createSerialNumberSchema = z.object({
  itemId: z.string().uuid(),
  serialNumber: z.string().min(1),
  lotNumberId: z.string().uuid().optional(),
  status: SerialStatusEnum.default('AVAILABLE'),
  purchaseDate: z.date().optional(),
  purchaseVendorId: z.string().uuid().optional(),
  saleDate: z.date().optional(),
  saleCustomerId: z.string().uuid().optional(),
  warrantyExpirationDate: z.date().optional(),
  notes: z.string().optional(),
});

export const updateSerialNumberSchema = createSerialNumberSchema.partial();

export type CreateSerialNumberInput = z.infer<typeof createSerialNumberSchema>;
export type UpdateSerialNumberInput = z.infer<typeof updateSerialNumberSchema>;

export interface SerialNumber {
  id: string;
  organizationId: string;
  itemId: string;
  serialNumber: string;
  lotNumberId: string | null;
  status: string;
  purchaseDate: Date | null;
  purchaseVendorId: string | null;
  saleDate: Date | null;
  saleCustomerId: string | null;
  warrantyExpirationDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Assembly Components
// ============================================================================

/**
 * Schema for creating assembly components
 */
export const createAssemblyComponentSchema = z.object({
  assemblyItemId: z.string().uuid(),
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitOfMeasureId: z.string().uuid().optional(),
  sequenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const updateAssemblyComponentSchema = createAssemblyComponentSchema.partial();

export type CreateAssemblyComponentInput = z.infer<typeof createAssemblyComponentSchema>;
export type UpdateAssemblyComponentInput = z.infer<typeof updateAssemblyComponentSchema>;

export interface AssemblyComponent {
  id: string;
  assemblyItemId: string;
  componentItemId: string;
  quantity: number;
  unitOfMeasureId: string | null;
  sequenceNumber: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Kit Components
// ============================================================================

/**
 * Schema for creating kit components
 */
export const createKitComponentSchema = z.object({
  kitItemId: z.string().uuid(),
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
  isOptional: z.boolean().default(false),
});

export const updateKitComponentSchema = createKitComponentSchema.partial();

export type CreateKitComponentInput = z.infer<typeof createKitComponentSchema>;
export type UpdateKitComponentInput = z.infer<typeof updateKitComponentSchema>;

export interface KitComponent {
  id: string;
  kitItemId: string;
  componentItemId: string;
  quantity: number;
  isOptional: boolean;
  createdAt: Date;
}

// ============================================================================
// Unified Assembly/Kit Components (for combined service)
// ============================================================================

/**
 * Schema for creating assembly or kit components (unified)
 */
export const createAssemblyKitComponentSchema = z.object({
  parentItemId: z.string().uuid(),
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitOfMeasureId: z.string().uuid().optional(),
  sequenceNumber: z.number().int().positive().optional(),
  isOptional: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateAssemblyKitComponentSchema = createAssemblyKitComponentSchema.partial();

export type CreateAssemblyKitComponentInput = z.infer<typeof createAssemblyKitComponentSchema>;
export type UpdateAssemblyKitComponentInput = z.infer<typeof updateAssemblyKitComponentSchema>;

export interface AssemblyKitComponent {
  id: string;
  parentItemId: string;
  componentItemId: string;
  quantity: number;
  unitOfMeasureId: string | null;
  sequenceNumber: number | null;
  isOptional: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
