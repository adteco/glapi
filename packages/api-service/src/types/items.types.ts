/**
 * Items & Inventory types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports items and inventory types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export all items & inventory types from centralized package
export {
  // Units of Measure
  createUnitsOfMeasureSchema,
  updateUnitsOfMeasureSchema,
  type CreateUnitsOfMeasureInput,
  type UpdateUnitsOfMeasureInput,
  type UnitsOfMeasure,

  // Item Categories
  createItemCategorySchema,
  updateItemCategorySchema,
  type CreateItemCategoryInput,
  type UpdateItemCategoryInput,
  type ItemCategory,

  // Items
  ItemTypeEnum,
  type ItemType,
  itemTypeEnum,
  createItemSchema,
  updateItemSchema,
  variantAttributeSchema,
  generateVariantsSchema,
  type CreateItemInput,
  type UpdateItemInput,
  type VariantAttribute,
  type GenerateVariantsInput,
  type Item,

  // Price Lists & Pricing
  createPriceListSchema,
  updatePriceListSchema,
  createItemPricingSchema,
  updateItemPricingSchema,
  assignCustomerPriceListSchema,
  priceCalculationSchema,
  type CreatePriceListInput,
  type UpdatePriceListInput,
  type CreateItemPricingInput,
  type UpdateItemPricingInput,
  type AssignCustomerPriceListInput,
  type PriceCalculationInput,
  type PriceList,
  type ItemPricing,
  type ItemPricingWithItem,
  type CalculatedPrice,

  // Vendor Items
  createVendorItemSchema,
  updateVendorItemSchema,
  type CreateVendorItemInput,
  type UpdateVendorItemInput,
  type VendorItem,

  // Inventory Tracking - Lot Numbers
  LotStatusEnum,
  type LotStatus,
  lotStatusEnum,
  createLotNumberSchema,
  updateLotNumberSchema,
  type CreateLotNumberInput,
  type UpdateLotNumberInput,
  type LotNumber,

  // Inventory Tracking - Serial Numbers
  SerialStatusEnum,
  type SerialStatus,
  serialStatusEnum,
  createSerialNumberSchema,
  updateSerialNumberSchema,
  type CreateSerialNumberInput,
  type UpdateSerialNumberInput,
  type SerialNumber,

  // Assembly Components
  createAssemblyComponentSchema,
  updateAssemblyComponentSchema,
  type CreateAssemblyComponentInput,
  type UpdateAssemblyComponentInput,
  type AssemblyComponent,

  // Kit Components
  createKitComponentSchema,
  updateKitComponentSchema,
  type CreateKitComponentInput,
  type UpdateKitComponentInput,
  type KitComponent,

  // Unified Assembly/Kit Components
  createAssemblyKitComponentSchema,
  updateAssemblyKitComponentSchema,
  type CreateAssemblyKitComponentInput,
  type UpdateAssemblyKitComponentInput,
  type AssemblyKitComponent,
} from '@glapi/types';
