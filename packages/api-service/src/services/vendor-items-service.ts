import { BaseService } from './base-service';
import { 
  VendorItem,
  CreateVendorItemInput,
  UpdateVendorItemInput,
  createVendorItemSchema,
  updateVendorItemSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { 
  vendorItemsRepository,
  itemsRepository,
  entityRepository
} from '@glapi/database';

export class VendorItemsService extends BaseService {
  /**
   * Transform database record to service layer type
   */
  private transformVendorItem(dbRecord: any): VendorItem {
    return {
      id: dbRecord.id,
      vendorId: dbRecord.vendorId,
      itemId: dbRecord.itemId,
      vendorItemCode: dbRecord.vendorItemCode,
      vendorItemName: dbRecord.vendorItemName,
      vendorUnitCost: dbRecord.vendorUnitCost ? parseFloat(dbRecord.vendorUnitCost) : null,
      leadTimeDays: dbRecord.leadTimeDays,
      minOrderQuantity: parseFloat(dbRecord.minOrderQuantity),
      isPreferred: dbRecord.isPreferred,
      lastPurchaseDate: dbRecord.lastPurchaseDate,
      lastPurchasePrice: dbRecord.lastPurchasePrice ? parseFloat(dbRecord.lastPurchasePrice) : null,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Get vendors for an item
   */
  async getItemVendors(itemId: string): Promise<VendorItem[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item belongs to organization
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    const vendors = await vendorItemsRepository.findVendorsForItem(itemId);
    
    return vendors.map(v => this.transformVendorItem(v));
  }

  /**
   * Get items for a vendor
   */
  async getVendorItems(
    vendorId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<VendorItem>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate vendor belongs to organization
    const vendor = await entityRepository.findById(vendorId, organizationId);
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    const items = await vendorItemsRepository.findItemsForVendor(vendorId);
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = items.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(i => this.transformVendorItem(i)),
      items.length,
      page,
      limit
    );
  }

  /**
   * Add item to vendor
   */
  async addVendorItem(input: CreateVendorItemInput): Promise<VendorItem> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = createVendorItemSchema.parse(input);
    
    // Validate vendor
    const vendor = await entityRepository.findById(
      validatedInput.vendorId,
      organizationId
    );
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    // Validate item
    const item = await itemsRepository.findById(
      validatedInput.itemId,
      organizationId
    );
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    // Check if item is purchasable
    if (!item.isPurchasable) {
      throw new ServiceError(
        'Item is not purchasable',
        'NOT_PURCHASABLE',
        400
      );
    }
    
    // Check if relationship already exists
    const existing = await vendorItemsRepository.findByVendorAndItem(
      validatedInput.vendorId,
      validatedInput.itemId
    );
    if (existing) {
      throw new ServiceError(
        'Item already assigned to vendor',
        'ALREADY_EXISTS',
        409
      );
    }
    
    const created = await vendorItemsRepository.create({
      vendorId: validatedInput.vendorId,
      itemId: validatedInput.itemId,
      vendorItemCode: validatedInput.vendorItemCode,
      vendorItemName: validatedInput.vendorItemName,
      vendorUnitCost: validatedInput.vendorUnitCost?.toString(),
      leadTimeDays: validatedInput.leadTimeDays,
      minOrderQuantity: validatedInput.minOrderQuantity.toString(),
      isPreferred: validatedInput.isPreferred,
    });
    
    return this.transformVendorItem(created);
  }

  /**
   * Update vendor item
   */
  async updateVendorItem(
    vendorId: string,
    itemId: string,
    input: UpdateVendorItemInput
  ): Promise<VendorItem> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = updateVendorItemSchema.parse(input);
    
    // Find the vendor item
    const vendorItem = await vendorItemsRepository.findByVendorAndItem(
      vendorId,
      itemId
    );
    if (!vendorItem) {
      throw new ServiceError(
        'Vendor item not found',
        'VENDOR_ITEM_NOT_FOUND',
        404
      );
    }
    
    // Validate ownership by checking vendor
    const vendor = await entityRepository.findById(vendorId, organizationId);
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    const updateData: any = { ...validatedInput };
    
    // Convert numeric fields
    if (validatedInput.vendorUnitCost !== undefined) {
      updateData.vendorUnitCost = validatedInput.vendorUnitCost?.toString() || null;
    }
    if (validatedInput.minOrderQuantity !== undefined) {
      updateData.minOrderQuantity = validatedInput.minOrderQuantity.toString();
    }
    
    const updated = await vendorItemsRepository.update(
      vendorItem.id,
      updateData
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update vendor item',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformVendorItem(updated);
  }

  /**
   * Remove item from vendor
   */
  async removeVendorItem(vendorId: string, itemId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate vendor belongs to organization
    const vendor = await entityRepository.findById(vendorId, organizationId);
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    await vendorItemsRepository.delete(vendorId, itemId);
  }

  /**
   * Set preferred vendor for an item
   */
  async setPreferredVendor(itemId: string, vendorId: string): Promise<VendorItem> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    // Validate vendor
    const vendor = await entityRepository.findById(vendorId, organizationId);
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    const updated = await vendorItemsRepository.setPreferredVendor(vendorId, itemId);
    
    return this.transformVendorItem(updated);
  }

  /**
   * Get preferred vendor for an item
   */
  async getPreferredVendor(itemId: string): Promise<VendorItem | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    const preferred = await vendorItemsRepository.getPreferredVendor(itemId);
    
    return preferred ? this.transformVendorItem(preferred) : null;
  }

  /**
   * Update purchase information after a purchase
   */
  async recordPurchase(
    vendorId: string,
    itemId: string,
    purchasePrice: number,
    purchaseDate?: Date
  ): Promise<VendorItem | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate vendor
    const vendor = await entityRepository.findById(vendorId, organizationId);
    if (!vendor || vendor.entityType !== 'Vendor') {
      throw new ServiceError(
        'Vendor not found',
        'VENDOR_NOT_FOUND',
        404
      );
    }
    
    const updated = await vendorItemsRepository.updatePurchaseInfo(
      vendorId,
      itemId,
      purchasePrice.toString(),
      purchaseDate
    );
    
    return updated ? this.transformVendorItem(updated) : null;
  }

  /**
   * Get the best (lowest) vendor cost for an item
   */
  async getBestVendorCost(itemId: string): Promise<{
    vendorId: string;
    cost: number;
  } | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate item
    const item = await itemsRepository.findById(itemId, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    const bestCost = await vendorItemsRepository.getBestVendorCost(itemId);
    
    return bestCost ? {
      vendorId: bestCost.vendorId,
      cost: parseFloat(bestCost.cost),
    } : null;
  }

  /**
   * Search vendor items
   */
  async searchVendorItems(params: {
    vendorId?: string;
    itemId?: string;
    isPreferred?: boolean;
  } = {}): Promise<VendorItem[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate vendor if provided
    if (params.vendorId) {
      const vendor = await entityRepository.findById(params.vendorId, organizationId);
      if (!vendor || vendor.entityType !== 'Vendor') {
        throw new ServiceError(
          'Vendor not found',
          'VENDOR_NOT_FOUND',
          404
        );
      }
    }
    
    // Validate item if provided
    if (params.itemId) {
      const item = await itemsRepository.findById(params.itemId, organizationId);
      if (!item) {
        throw new ServiceError(
          'Item not found',
          'ITEM_NOT_FOUND',
          404
        );
      }
    }
    
    const vendorItems = await vendorItemsRepository.find(params);
    
    return vendorItems.map(vi => this.transformVendorItem(vi));
  }
}