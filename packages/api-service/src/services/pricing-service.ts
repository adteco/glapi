import { BaseService } from './base-service';
import { 
  PriceList,
  ItemPricing,
  ItemPricingWithItem,
  CalculatedPrice,
  CreatePriceListInput,
  UpdatePriceListInput,
  CreateItemPricingInput,
  UpdateItemPricingInput,
  AssignCustomerPriceListInput,
  PriceCalculationInput,
  createPriceListSchema,
  updatePriceListSchema,
  createItemPricingSchema,
  updateItemPricingSchema,
  assignCustomerPriceListSchema,
  priceCalculationSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { 
  PricingRepository,
  ItemsRepository,
  EntityRepository
} from '@glapi/database';

const pricingRepository = new PricingRepository();
const itemsRepository = new ItemsRepository();
const entityRepository = new EntityRepository();

export class PricingService extends BaseService {
  /**
   * Transform database price list to service layer type
   */
  private transformPriceList(dbRecord: any): PriceList {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      name: dbRecord.name,
      code: dbRecord.code,
      description: dbRecord.description || undefined,
      currencyCode: dbRecord.currencyCode,
      isDefault: dbRecord.isDefault,
      isActive: dbRecord.isActive,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * Transform database item pricing to service layer type
   */
  private transformItemPricing(dbRecord: any): ItemPricingWithItem {
    return {
      id: dbRecord.id,
      itemId: dbRecord.itemId,
      priceListId: dbRecord.priceListId,
      unitPrice: parseFloat(dbRecord.unitPrice),
      minQuantity: parseFloat(dbRecord.minQuantity),
      effectiveDate: dbRecord.effectiveDate,
      expirationDate: dbRecord.expirationDate,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      item: dbRecord.item || undefined,
    };
  }

  // Price List Methods

  /**
   * List price lists
   */
  async listPriceLists(
    params: PaginationParams & { activeOnly?: boolean } = {}
  ): Promise<PaginatedResult<PriceList>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    const priceLists = await pricingRepository.findPriceLists(
      organizationId,
      params.activeOnly ?? true
    );
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = priceLists.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(pl => this.transformPriceList(pl)),
      priceLists.length,
      page,
      limit
    );
  }

  /**
   * Get a price list by ID
   */
  async getPriceList(id: string): Promise<PriceList> {
    const organizationId = this.requireOrganizationContext();
    
    const priceList = await pricingRepository.findPriceListById(id, organizationId);
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    return this.transformPriceList(priceList);
  }

  /**
   * Create a price list
   */
  async createPriceList(input: CreatePriceListInput): Promise<PriceList> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = createPriceListSchema.parse(input);
    
    // Check if code already exists
    const existing = await pricingRepository.findPriceListByCode(
      validatedInput.code,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Price list with this code already exists',
        'DUPLICATE_CODE',
        409
      );
    }
    
    const created = await pricingRepository.createPriceList({
      organizationId,
      name: validatedInput.name,
      code: validatedInput.code,
      description: validatedInput.description,
      currencyCode: validatedInput.currencyCode,
      isDefault: validatedInput.isDefault,
      isActive: validatedInput.isActive,
    });
    
    return this.transformPriceList(created);
  }

  /**
   * Update a price list
   */
  async updatePriceList(
    id: string,
    input: UpdatePriceListInput
  ): Promise<PriceList> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = updatePriceListSchema.parse(input);
    
    // Check if price list exists
    const existing = await pricingRepository.findPriceListById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    // Check if code is being changed and already exists
    if (validatedInput.code && validatedInput.code !== existing.code) {
      const codeExists = await pricingRepository.findPriceListByCode(
        validatedInput.code,
        organizationId
      );
      if (codeExists) {
        throw new ServiceError(
          'Price list with this code already exists',
          'DUPLICATE_CODE',
          409
        );
      }
    }
    
    const updated = await pricingRepository.updatePriceList(
      id,
      organizationId,
      validatedInput
    );
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update price list',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformPriceList(updated);
  }

  /**
   * Delete a price list
   */
  async deletePriceList(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      await pricingRepository.deletePriceList(id, organizationId);
    } catch (error: any) {
      if (error.message.includes('associated item prices')) {
        throw new ServiceError(
          'Cannot delete price list with associated item prices',
          'HAS_PRICES',
          409
        );
      }
      throw new ServiceError(
        'Failed to delete price list',
        'DELETE_FAILED',
        500
      );
    }
  }

  // Item Pricing Methods

  /**
   * Get prices for an item
   */
  async getItemPrices(itemId: string, priceListId?: string): Promise<ItemPricing[]> {
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
    
    const prices = await pricingRepository.findItemPrices(itemId, priceListId);
    
    return prices.map(p => this.transformItemPricing(p));
  }

  /**
   * Get items in a price list
   */
  async getPriceListItems(
    priceListId: string,
    params: PaginationParams = {}
  ): Promise<PaginatedResult<ItemPricingWithItem>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    // Validate price list belongs to organization
    const priceList = await pricingRepository.findPriceListById(
      priceListId,
      organizationId
    );
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    const items = await pricingRepository.findPriceListItems(priceListId);
    
    console.log('Raw items from repository:', JSON.stringify(items[0], null, 2));
    
    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = items.slice(startIdx, endIdx);
    
    return this.createPaginatedResult(
      paginatedData.map(i => this.transformItemPricing(i)),
      items.length,
      page,
      limit
    );
  }

  /**
   * Create item pricing
   */
  async createItemPricing(input: CreateItemPricingInput): Promise<ItemPricing> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = createItemPricingSchema.parse(input);
    
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
    
    // Validate price list
    const priceList = await pricingRepository.findPriceListById(
      validatedInput.priceListId,
      organizationId
    );
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    // Check for overlapping quantity breaks
    const existingPrices = await pricingRepository.findItemPrices(
      validatedInput.itemId,
      validatedInput.priceListId
    );
    
    const hasOverlap = existingPrices.some(price => {
      const priceEffectiveDate = new Date(price.effectiveDate);
      const priceExpirationDate = price.expirationDate ? new Date(price.expirationDate) : null;
      const priceEffective = priceEffectiveDate <= validatedInput.effectiveDate;
      const priceNotExpired = !priceExpirationDate || 
        priceExpirationDate >= validatedInput.effectiveDate;
      const quantityOverlap = parseFloat(price.minQuantity) === validatedInput.minQuantity;
      
      return priceEffective && priceNotExpired && quantityOverlap;
    });
    
    if (hasOverlap) {
      throw new ServiceError(
        'Price already exists for this quantity break and date range',
        'DUPLICATE_PRICE',
        409
      );
    }
    
    const created = await pricingRepository.createItemPricing({
      itemId: validatedInput.itemId,
      priceListId: validatedInput.priceListId,
      unitPrice: validatedInput.unitPrice.toString(),
      minQuantity: validatedInput.minQuantity.toString(),
      effectiveDate: validatedInput.effectiveDate.toISOString().split('T')[0],
      expirationDate: validatedInput.expirationDate ? validatedInput.expirationDate.toISOString().split('T')[0] : undefined,
    });
    
    return this.transformItemPricing(created);
  }

  /**
   * Update item pricing
   */
  async updateItemPricing(
    id: string,
    input: UpdateItemPricingInput
  ): Promise<ItemPricing> {
    // Validate input
    const validatedInput = updateItemPricingSchema.parse(input);
    
    const updateData: any = {};
    if (validatedInput.unitPrice !== undefined) {
      updateData.unitPrice = validatedInput.unitPrice.toString();
    }
    if (validatedInput.minQuantity !== undefined) {
      updateData.minQuantity = validatedInput.minQuantity.toString();
    }
    if (validatedInput.effectiveDate !== undefined) {
      updateData.effectiveDate = validatedInput.effectiveDate;
    }
    if (validatedInput.expirationDate !== undefined) {
      updateData.expirationDate = validatedInput.expirationDate;
    }
    
    const updated = await pricingRepository.updateItemPricing(id, updateData);
    
    if (!updated) {
      throw new ServiceError(
        'Item pricing not found',
        'PRICING_NOT_FOUND',
        404
      );
    }
    
    return this.transformItemPricing(updated);
  }

  /**
   * Delete item pricing
   */
  async deleteItemPricing(id: string): Promise<void> {
    const deleted = await pricingRepository.deleteItemPricing(id);
    
    if (!deleted) {
      throw new ServiceError(
        'Item pricing not found',
        'PRICING_NOT_FOUND',
        404
      );
    }
  }

  // Customer Price List Methods

  /**
   * Assign price list to customer
   */
  async assignCustomerPriceList(
    input: AssignCustomerPriceListInput
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = assignCustomerPriceListSchema.parse(input);
    
    // Validate customer
    const customer = await entityRepository.findById(
      validatedInput.customerId,
      organizationId
    );
    if (!customer || !customer.entityTypes.includes('Customer')) {
      throw new ServiceError(
        'Customer not found',
        'CUSTOMER_NOT_FOUND',
        404
      );
    }
    
    // Validate price list
    const priceList = await pricingRepository.findPriceListById(
      validatedInput.priceListId,
      organizationId
    );
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    await pricingRepository.assignPriceListToCustomer({
      customerId: validatedInput.customerId,
      priceListId: validatedInput.priceListId,
      priority: validatedInput.priority.toString(),
      effectiveDate: validatedInput.effectiveDate ? validatedInput.effectiveDate.toISOString().split('T')[0] : undefined,
      expirationDate: validatedInput.expirationDate ? validatedInput.expirationDate.toISOString().split('T')[0] : undefined,
    });
  }

  /**
   * Remove price list from customer
   */
  async removeCustomerPriceList(
    customerId: string,
    priceListId: string
  ): Promise<void> {
    await pricingRepository.removeCustomerPriceList(customerId, priceListId);
  }

  // Price Calculation Methods

  /**
   * Calculate price for an item
   */
  async calculatePrice(input: PriceCalculationInput): Promise<CalculatedPrice | null> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = priceCalculationSchema.parse(input);
    
    const price = await pricingRepository.calculatePrice({
      itemId: validatedInput.itemId,
      customerId: validatedInput.customerId,
      quantity: validatedInput.quantity,
      date: validatedInput.date,
      organizationId,
    });
    
    return price;
  }

  /**
   * Copy prices from one price list to another
   */
  async copyPrices(
    sourcePriceListId: string,
    targetPriceListId: string
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      await pricingRepository.copyPrices(
        sourcePriceListId,
        targetPriceListId,
        organizationId
      );
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw new ServiceError(
          'Price list not found',
          'PRICE_LIST_NOT_FOUND',
          404
        );
      }
      throw new ServiceError(
        'Failed to copy prices',
        'COPY_FAILED',
        500
      );
    }
  }

  /**
   * Bulk update prices in a price list
   */
  async bulkUpdatePrices(
    priceListId: string,
    updates: Array<{
      itemId: string;
      unitPrice: number;
      minQuantity?: number;
      effectiveDate?: Date;
      expirationDate?: Date;
    }>
  ): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate price list
    const priceList = await pricingRepository.findPriceListById(
      priceListId,
      organizationId
    );
    if (!priceList) {
      throw new ServiceError(
        'Price list not found',
        'PRICE_LIST_NOT_FOUND',
        404
      );
    }
    
    // Delete existing prices
    for (const update of updates) {
      await pricingRepository.deleteItemFromPriceList(update.itemId, priceListId);
    }
    
    // Create new prices
    const newPrices = updates.map(update => ({
      itemId: update.itemId,
      priceListId,
      unitPrice: update.unitPrice.toString(),
      minQuantity: (update.minQuantity || 1).toString(),
      effectiveDate: (update.effectiveDate || new Date()).toISOString().split('T')[0],
      expirationDate: update.expirationDate ? update.expirationDate.toISOString().split('T')[0] : undefined,
    }));
    
    await pricingRepository.createManyItemPrices(newPrices);
  }
}