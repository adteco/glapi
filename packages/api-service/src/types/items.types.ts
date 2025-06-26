import { z } from 'zod';

// Units of Measure Types
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

// Item Categories Types
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

// Items Types
export const itemTypeEnum = z.enum([
  'INVENTORY_ITEM',
  'NON_INVENTORY_ITEM',
  'SERVICE',
  'CHARGE',
  'DISCOUNT',
  'TAX',
  'ASSEMBLY',
  'KIT'
]);

export const createItemSchema = z.object({
  itemCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  itemType: itemTypeEnum,
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

export const variantAttributeSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
});

export const generateVariantsSchema = z.object({
  parentItemId: z.string().uuid(),
  attributes: z.array(variantAttributeSchema).min(1),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
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

// Pricing Types
export const createPriceListSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  currencyCode: z.string().default('USD'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updatePriceListSchema = createPriceListSchema.partial();

export const createItemPricingSchema = z.object({
  itemId: z.string().uuid(),
  priceListId: z.string().uuid(),
  unitPrice: z.number().positive(),
  minQuantity: z.number().positive().default(1),
  effectiveDate: z.string().transform((str) => new Date(str)),
  expirationDate: z.string().transform((str) => new Date(str)).optional().nullable(),
});

export const updateItemPricingSchema = createItemPricingSchema.partial();

export const assignCustomerPriceListSchema = z.object({
  customerId: z.string().uuid(),
  priceListId: z.string().uuid(),
  priority: z.number().int().positive().default(1),
  effectiveDate: z.string().transform((str) => new Date(str)).optional(),
  expirationDate: z.string().transform((str) => new Date(str)).optional(),
});

export const priceCalculationSchema = z.object({
  itemId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  date: z.string().transform((str) => new Date(str)).default(() => new Date().toISOString()),
});

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type CreateItemPricingInput = z.infer<typeof createItemPricingSchema>;
export type UpdateItemPricingInput = z.infer<typeof updateItemPricingSchema>;
export type AssignCustomerPriceListInput = z.infer<typeof assignCustomerPriceListSchema>;
export type PriceCalculationInput = z.infer<typeof priceCalculationSchema>;

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

export interface CalculatedPrice {
  unitPrice: number;
  priceListId: string;
  priceListName: string;
  minQuantity: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

// Vendor Items Types
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

// Inventory Tracking Types
export const lotStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'RECALLED']);
export const serialStatusEnum = z.enum(['AVAILABLE', 'SOLD', 'IN_TRANSIT', 'RETURNED', 'DAMAGED', 'LOST']);

export const createLotNumberSchema = z.object({
  itemId: z.string().uuid(),
  lotNumber: z.string().min(1),
  manufactureDate: z.date().optional(),
  expirationDate: z.date().optional(),
  quantityReceived: z.number().positive(),
  quantityOnHand: z.number().nonnegative(),
  status: lotStatusEnum.default('ACTIVE'),
  notes: z.string().optional(),
});

export const updateLotNumberSchema = createLotNumberSchema.partial();

export const createSerialNumberSchema = z.object({
  itemId: z.string().uuid(),
  serialNumber: z.string().min(1),
  lotNumberId: z.string().uuid().optional(),
  status: serialStatusEnum.default('AVAILABLE'),
  purchaseDate: z.date().optional(),
  purchaseVendorId: z.string().uuid().optional(),
  saleDate: z.date().optional(),
  saleCustomerId: z.string().uuid().optional(),
  warrantyExpirationDate: z.date().optional(),
  notes: z.string().optional(),
});

export const updateSerialNumberSchema = createSerialNumberSchema.partial();

export type CreateLotNumberInput = z.infer<typeof createLotNumberSchema>;
export type UpdateLotNumberInput = z.infer<typeof updateLotNumberSchema>;
export type CreateSerialNumberInput = z.infer<typeof createSerialNumberSchema>;
export type UpdateSerialNumberInput = z.infer<typeof updateSerialNumberSchema>;

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

// Assembly/Kit Types
export const createAssemblyComponentSchema = z.object({
  assemblyItemId: z.string().uuid(),
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitOfMeasureId: z.string().uuid().optional(),
  sequenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const updateAssemblyComponentSchema = createAssemblyComponentSchema.partial();

export const createKitComponentSchema = z.object({
  kitItemId: z.string().uuid(),
  componentItemId: z.string().uuid(),
  quantity: z.number().positive(),
  isOptional: z.boolean().default(false),
});

export const updateKitComponentSchema = createKitComponentSchema.partial();

export type CreateAssemblyComponentInput = z.infer<typeof createAssemblyComponentSchema>;
export type UpdateAssemblyComponentInput = z.infer<typeof updateAssemblyComponentSchema>;
export type CreateKitComponentInput = z.infer<typeof createKitComponentSchema>;
export type UpdateKitComponentInput = z.infer<typeof updateKitComponentSchema>;

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

export interface KitComponent {
  id: string;
  kitItemId: string;
  componentItemId: string;
  quantity: number;
  isOptional: boolean;
  createdAt: Date;
}

// Assembly/Kit Component Types (for the unified service)
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