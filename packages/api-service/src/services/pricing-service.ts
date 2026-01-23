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
  // Labor Rate types
  PriceListLaborRate,
  PriceListLaborRateWithRelations,
  CreatePriceListLaborRateInput,
  UpdatePriceListLaborRateInput,
  PriceListLaborRateFilters,
  BillingRateCalculationInput,
  CalculatedBillingRate,
  createPriceListLaborRateSchema,
  updatePriceListLaborRateSchema,
  billingRateCalculationSchema,
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
      const quantityOverlap = price.minQuantity ? parseFloat(price.minQuantity) === validatedInput.minQuantity : false;
      
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

  // ============================================================================
  // Price List Labor Rates Methods (Rate Cards)
  // ============================================================================

  /**
   * Transform database labor rate to service layer type
   */
  private transformLaborRate(dbRecord: any): PriceListLaborRateWithRelations {
    return {
      id: dbRecord.id,
      priceListId: dbRecord.priceListId,
      employeeId: dbRecord.employeeId,
      laborRole: dbRecord.laborRole,
      projectId: dbRecord.projectId,
      costCodeId: dbRecord.costCodeId,
      laborRate: parseFloat(dbRecord.laborRate),
      burdenRate: parseFloat(dbRecord.burdenRate),
      billingRate: parseFloat(dbRecord.billingRate),
      overtimeMultiplier: parseFloat(dbRecord.overtimeMultiplier),
      doubleTimeMultiplier: parseFloat(dbRecord.doubleTimeMultiplier),
      priority: dbRecord.priority,
      effectiveDate: dbRecord.effectiveDate,
      expirationDate: dbRecord.expirationDate,
      description: dbRecord.description,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      employee: dbRecord.employee?.id ? {
        id: dbRecord.employee.id,
        displayName: dbRecord.employee.displayName,
        email: dbRecord.employee.email,
      } : undefined,
      project: dbRecord.project?.id ? {
        id: dbRecord.project.id,
        name: dbRecord.project.name,
        projectCode: dbRecord.project.projectCode,
      } : undefined,
      costCode: dbRecord.costCode?.id ? {
        id: dbRecord.costCode.id,
        costCode: dbRecord.costCode.costCode,
        name: dbRecord.costCode.name,
      } : undefined,
    };
  }

  /**
   * List labor rates for a price list
   */
  async listPriceListLaborRates(
    priceListId: string,
    filters: Partial<PriceListLaborRateFilters> = {},
    params: PaginationParams = {}
  ): Promise<PaginatedResult<PriceListLaborRateWithRelations>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);

    // Validate price list belongs to organization
    const priceList = await pricingRepository.findPriceListById(priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Price list not found', 'PRICE_LIST_NOT_FOUND', 404);
    }

    const laborRates = await pricingRepository.findPriceListLaborRates(priceListId, {
      ...filters,
      activeOnly: filters.activeOnly ?? false,
    });

    // Manual pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedData = laborRates.slice(startIdx, endIdx);

    return this.createPaginatedResult(
      paginatedData.map(lr => this.transformLaborRate(lr)),
      laborRates.length,
      page,
      limit
    );
  }

  /**
   * Get a single labor rate by ID
   */
  async getLaborRate(id: string): Promise<PriceListLaborRateWithRelations> {
    const organizationId = this.requireOrganizationContext();

    const laborRate = await pricingRepository.findLaborRateById(id);
    if (!laborRate) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    // Verify the price list belongs to the organization
    const priceList = await pricingRepository.findPriceListById(laborRate.priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    return this.transformLaborRate(laborRate);
  }

  /**
   * Create a labor rate
   */
  async createLaborRate(input: CreatePriceListLaborRateInput): Promise<PriceListLaborRateWithRelations> {
    const organizationId = this.requireOrganizationContext();

    // Validate input
    const validatedInput = createPriceListLaborRateSchema.parse(input);

    // Validate price list
    const priceList = await pricingRepository.findPriceListById(validatedInput.priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Price list not found', 'PRICE_LIST_NOT_FOUND', 404);
    }

    // Validate employee if provided
    if (validatedInput.employeeId) {
      const employee = await entityRepository.findById(validatedInput.employeeId, organizationId);
      if (!employee || !employee.entityTypes.includes('Employee')) {
        throw new ServiceError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
      }
    }

    const created = await pricingRepository.createPriceListLaborRate({
      priceListId: validatedInput.priceListId,
      employeeId: validatedInput.employeeId || null,
      laborRole: validatedInput.laborRole || null,
      projectId: validatedInput.projectId || null,
      costCodeId: validatedInput.costCodeId || null,
      laborRate: validatedInput.laborRate.toString(),
      burdenRate: validatedInput.burdenRate.toString(),
      billingRate: validatedInput.billingRate.toString(),
      overtimeMultiplier: validatedInput.overtimeMultiplier.toString(),
      doubleTimeMultiplier: validatedInput.doubleTimeMultiplier.toString(),
      priority: validatedInput.priority,
      effectiveDate: validatedInput.effectiveDate.toISOString().split('T')[0],
      expirationDate: validatedInput.expirationDate
        ? validatedInput.expirationDate.toISOString().split('T')[0]
        : null,
      description: validatedInput.description || null,
    });

    // Fetch the full record with relations
    const fullRecord = await pricingRepository.findLaborRateById(created.id);
    return this.transformLaborRate(fullRecord);
  }

  /**
   * Update a labor rate
   */
  async updateLaborRate(
    id: string,
    input: UpdatePriceListLaborRateInput
  ): Promise<PriceListLaborRateWithRelations> {
    const organizationId = this.requireOrganizationContext();

    // Validate input
    const validatedInput = updatePriceListLaborRateSchema.parse(input);

    // Check if labor rate exists
    const existing = await pricingRepository.findLaborRateById(id);
    if (!existing) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    // Verify the price list belongs to the organization
    const priceList = await pricingRepository.findPriceListById(existing.priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    // Validate employee if being updated
    if (validatedInput.employeeId) {
      const employee = await entityRepository.findById(validatedInput.employeeId, organizationId);
      if (!employee || !employee.entityTypes.includes('Employee')) {
        throw new ServiceError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
      }
    }

    const updateData: Record<string, any> = {};

    if (validatedInput.employeeId !== undefined) {
      updateData.employeeId = validatedInput.employeeId || null;
    }
    if (validatedInput.laborRole !== undefined) {
      updateData.laborRole = validatedInput.laborRole || null;
    }
    if (validatedInput.projectId !== undefined) {
      updateData.projectId = validatedInput.projectId || null;
    }
    if (validatedInput.costCodeId !== undefined) {
      updateData.costCodeId = validatedInput.costCodeId || null;
    }
    if (validatedInput.laborRate !== undefined) {
      updateData.laborRate = validatedInput.laborRate.toString();
    }
    if (validatedInput.burdenRate !== undefined) {
      updateData.burdenRate = validatedInput.burdenRate.toString();
    }
    if (validatedInput.billingRate !== undefined) {
      updateData.billingRate = validatedInput.billingRate.toString();
    }
    if (validatedInput.overtimeMultiplier !== undefined) {
      updateData.overtimeMultiplier = validatedInput.overtimeMultiplier.toString();
    }
    if (validatedInput.doubleTimeMultiplier !== undefined) {
      updateData.doubleTimeMultiplier = validatedInput.doubleTimeMultiplier.toString();
    }
    if (validatedInput.priority !== undefined) {
      updateData.priority = validatedInput.priority;
    }
    if (validatedInput.effectiveDate !== undefined) {
      updateData.effectiveDate = validatedInput.effectiveDate.toISOString().split('T')[0];
    }
    if (validatedInput.expirationDate !== undefined) {
      updateData.expirationDate = validatedInput.expirationDate
        ? validatedInput.expirationDate.toISOString().split('T')[0]
        : null;
    }
    if (validatedInput.description !== undefined) {
      updateData.description = validatedInput.description || null;
    }

    await pricingRepository.updatePriceListLaborRate(id, updateData);

    // Fetch the full record with relations
    const fullRecord = await pricingRepository.findLaborRateById(id);
    return this.transformLaborRate(fullRecord);
  }

  /**
   * Delete a labor rate
   */
  async deleteLaborRate(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    // Check if labor rate exists
    const existing = await pricingRepository.findLaborRateById(id);
    if (!existing) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    // Verify the price list belongs to the organization
    const priceList = await pricingRepository.findPriceListById(existing.priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Labor rate not found', 'LABOR_RATE_NOT_FOUND', 404);
    }

    await pricingRepository.deletePriceListLaborRate(id);
  }

  /**
   * Calculate the billing rate for a given set of parameters
   */
  async calculateBillingRate(input: BillingRateCalculationInput): Promise<CalculatedBillingRate | null> {
    const organizationId = this.requireOrganizationContext();

    // Validate input
    const validatedInput = billingRateCalculationSchema.parse(input);

    const rate = await pricingRepository.calculateBillingRate({
      customerId: validatedInput.customerId,
      employeeId: validatedInput.employeeId,
      laborRole: validatedInput.laborRole,
      projectId: validatedInput.projectId,
      costCodeId: validatedInput.costCodeId,
      date: validatedInput.date,
      organizationId,
    });

    return rate;
  }

  /**
   * Get the full rate card for a price list (both item pricing and labor rates)
   */
  async getFullRateCard(
    priceListId: string,
    params: PaginationParams = {}
  ): Promise<{
    priceList: PriceList;
    itemPricing: PaginatedResult<ItemPricingWithItem>;
    laborRates: PaginatedResult<PriceListLaborRateWithRelations>;
  }> {
    const organizationId = this.requireOrganizationContext();

    // Validate price list belongs to organization
    const priceList = await pricingRepository.findPriceListById(priceListId, organizationId);
    if (!priceList) {
      throw new ServiceError('Price list not found', 'PRICE_LIST_NOT_FOUND', 404);
    }

    // Fetch both item pricing and labor rates
    const [itemPricing, laborRates] = await Promise.all([
      this.getPriceListItems(priceListId, params),
      this.listPriceListLaborRates(priceListId, { activeOnly: false }, params),
    ]);

    return {
      priceList: this.transformPriceList(priceList),
      itemPricing,
      laborRates,
    };
  }

  /**
   * Copy labor rates from one price list to another
   */
  async copyLaborRates(sourcePriceListId: string, targetPriceListId: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();

    try {
      await pricingRepository.copyLaborRates(sourcePriceListId, targetPriceListId, organizationId);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw new ServiceError('Price list not found', 'PRICE_LIST_NOT_FOUND', 404);
      }
      throw new ServiceError('Failed to copy labor rates', 'COPY_FAILED', 500);
    }
  }
}