import { BaseService } from './base-service';
import { 
  Item,
  CreateItemInput,
  UpdateItemInput,
  GenerateVariantsInput,
  createItemSchema,
  updateItemSchema,
  generateVariantsSchema,
  ServiceError,
  PaginatedResult,
  PaginationParams
} from '../types';
import { 
  ItemsRepository,
  UnitsOfMeasureRepository,
  ItemCategoriesRepository,
  AccountRepository,
  // AssembliesKitsRepository,
  type ItemSearchParams
} from '@glapi/database';

// Create repository instances
const itemsRepository = new ItemsRepository();
const unitsOfMeasureRepository = new UnitsOfMeasureRepository();
const itemCategoriesRepository = new ItemCategoriesRepository();
const accountRepository = new AccountRepository();
// const assembliesKitsRepository = new AssembliesKitsRepository();

export class ItemsService extends BaseService {
  /**
   * Transform database record to service layer type
   */
  private transformItem(dbRecord: any): Item {
    return {
      id: dbRecord.id,
      organizationId: dbRecord.organizationId,
      itemCode: dbRecord.itemCode,
      name: dbRecord.name,
      description: dbRecord.description || undefined,
      itemType: dbRecord.itemType,
      isParent: dbRecord.isParent,
      parentItemId: dbRecord.parentItemId,
      variantAttributes: dbRecord.variantAttributes,
      categoryId: dbRecord.categoryId,
      unitOfMeasureId: dbRecord.unitOfMeasureId,
      incomeAccountId: dbRecord.incomeAccountId,
      expenseAccountId: dbRecord.expenseAccountId,
      assetAccountId: dbRecord.assetAccountId,
      cogsAccountId: dbRecord.cogsAccountId,
      defaultPrice: dbRecord.defaultPrice ? parseFloat(dbRecord.defaultPrice) : null,
      defaultCost: dbRecord.defaultCost ? parseFloat(dbRecord.defaultCost) : null,
      isTaxable: dbRecord.isTaxable,
      taxCode: dbRecord.taxCode,
      isActive: dbRecord.isActive,
      isPurchasable: dbRecord.isPurchasable,
      isSaleable: dbRecord.isSaleable,
      trackQuantity: dbRecord.trackQuantity,
      trackLotNumbers: dbRecord.trackLotNumbers,
      trackSerialNumbers: dbRecord.trackSerialNumbers,
      sku: dbRecord.sku,
      upc: dbRecord.upc,
      manufacturerPartNumber: dbRecord.manufacturerPartNumber,
      weight: dbRecord.weight ? parseFloat(dbRecord.weight) : null,
      weightUnit: dbRecord.weightUnit,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  /**
   * List items with filters
   */
  async listItems(
    params: PaginationParams & {
      search?: string;
      itemType?: string;
      categoryId?: string;
      isActive?: boolean;
      isPurchasable?: boolean;
      isSaleable?: boolean;
      parentItemId?: string | null;
      includeVariants?: boolean;
    } = {}
  ): Promise<PaginatedResult<Item>> {
    const organizationId = this.requireOrganizationContext();
    const { page, limit } = this.getPaginationParams(params);
    
    const searchParams: ItemSearchParams = {
      query: params.search,
      itemType: params.itemType,
      categoryId: params.categoryId,
      isActive: params.isActive,
      isPurchasable: params.isPurchasable,
      isSaleable: params.isSaleable,
      parentItemId: params.parentItemId,
      includeVariants: params.includeVariants,
      limit,
      offset: (page - 1) * limit,
    };
    
    const items = await itemsRepository.findByOrganization(organizationId, searchParams);
    
    // Get total count (would need to add a count method to repository)
    const totalParams = { ...searchParams, limit: undefined, offset: undefined };
    const allItems = await itemsRepository.findByOrganization(organizationId, totalParams);
    const total = allItems.length;
    
    return this.createPaginatedResult(
      items.map(i => this.transformItem(i)),
      total,
      page,
      limit
    );
  }

  /**
   * Get an item by ID
   */
  async getItem(id: string): Promise<Item> {
    const organizationId = this.requireOrganizationContext();
    
    const item = await itemsRepository.findById(id, organizationId);
    if (!item) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    return this.transformItem(item);
  }

  /**
   * Get item variants
   */
  async getItemVariants(parentItemId: string): Promise<Item[]> {
    const organizationId = this.requireOrganizationContext();
    
    const variants = await itemsRepository.findVariants(parentItemId, organizationId);
    
    return variants.map(v => this.transformItem(v));
  }

  /**
   * Create a new item
   */
  async createItem(input: CreateItemInput): Promise<Item> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = createItemSchema.parse(input);
    
    // Check if item code already exists
    const existing = await itemsRepository.findByCode(
      validatedInput.itemCode,
      organizationId
    );
    if (existing) {
      throw new ServiceError(
        'Item with this code already exists',
        'DUPLICATE_CODE',
        409
      );
    }
    
    // Validate unit of measure
    const uom = await unitsOfMeasureRepository.findById(
      validatedInput.unitOfMeasureId,
      organizationId
    );
    if (!uom) {
      throw new ServiceError(
        'Unit of measure not found',
        'INVALID_UOM',
        400
      );
    }
    
    // Validate category if provided
    if (validatedInput.categoryId) {
      const category = await itemCategoriesRepository.findById(
        validatedInput.categoryId,
        organizationId
      );
      if (!category) {
        throw new ServiceError(
          'Category not found',
          'INVALID_CATEGORY',
          400
        );
      }
    }
    
    // Validate GL accounts based on item type
    await this.validateGLAccounts(validatedInput, organizationId);
    
    // Validate parent item if creating a variant
    if (validatedInput.parentItemId) {
      const parent = await itemsRepository.findById(
        validatedInput.parentItemId,
        organizationId
      );
      if (!parent) {
        throw new ServiceError(
          'Parent item not found',
          'INVALID_PARENT',
          400
        );
      }
      if (!parent.isParent) {
        throw new ServiceError(
          'Parent item must be marked as parent',
          'INVALID_PARENT',
          400
        );
      }
    }
    
    const created = await itemsRepository.create({
      organizationId,
      itemCode: validatedInput.itemCode,
      name: validatedInput.name,
      description: validatedInput.description,
      itemType: validatedInput.itemType,
      isParent: validatedInput.isParent,
      parentItemId: validatedInput.parentItemId,
      variantAttributes: validatedInput.variantAttributes,
      categoryId: validatedInput.categoryId,
      unitOfMeasureId: validatedInput.unitOfMeasureId,
      incomeAccountId: validatedInput.incomeAccountId,
      expenseAccountId: validatedInput.expenseAccountId,
      assetAccountId: validatedInput.assetAccountId,
      cogsAccountId: validatedInput.cogsAccountId,
      defaultPrice: validatedInput.defaultPrice?.toString(),
      defaultCost: validatedInput.defaultCost?.toString(),
      isTaxable: validatedInput.isTaxable,
      taxCode: validatedInput.taxCode,
      isActive: validatedInput.isActive,
      isPurchasable: validatedInput.isPurchasable,
      isSaleable: validatedInput.isSaleable,
      trackQuantity: validatedInput.trackQuantity,
      trackLotNumbers: validatedInput.trackLotNumbers,
      trackSerialNumbers: validatedInput.trackSerialNumbers,
      sku: validatedInput.sku,
      upc: validatedInput.upc,
      manufacturerPartNumber: validatedInput.manufacturerPartNumber,
      weight: validatedInput.weight?.toString(),
      weightUnit: validatedInput.weightUnit,
      createdBy: userId,
      updatedBy: userId,
    });
    
    return this.transformItem(created);
  }

  /**
   * Update an item
   */
  async updateItem(
    id: string,
    input: UpdateItemInput
  ): Promise<Item> {
    const organizationId = this.requireOrganizationContext();
    const userId = this.requireUserContext();
    
    // Validate input
    const validatedInput = updateItemSchema.parse(input);
    
    // Check if item exists
    const existing = await itemsRepository.findById(id, organizationId);
    if (!existing) {
      throw new ServiceError(
        'Item not found',
        'ITEM_NOT_FOUND',
        404
      );
    }
    
    // Check if code is being changed and already exists
    if (validatedInput.itemCode && validatedInput.itemCode !== existing.itemCode) {
      const codeExists = await itemsRepository.findByCode(
        validatedInput.itemCode,
        organizationId
      );
      if (codeExists) {
        throw new ServiceError(
          'Item with this code already exists',
          'DUPLICATE_CODE',
          409
        );
      }
    }
    
    // Validate unit of measure if changed
    if (validatedInput.unitOfMeasureId) {
      const uom = await unitsOfMeasureRepository.findById(
        validatedInput.unitOfMeasureId,
        organizationId
      );
      if (!uom) {
        throw new ServiceError(
          'Unit of measure not found',
          'INVALID_UOM',
          400
        );
      }
    }
    
    // Validate category if changed
    if (validatedInput.categoryId !== undefined) {
      if (validatedInput.categoryId) {
        const category = await itemCategoriesRepository.findById(
          validatedInput.categoryId,
          organizationId
        );
        if (!category) {
          throw new ServiceError(
            'Category not found',
            'INVALID_CATEGORY',
            400
          );
        }
      }
    }
    
    // Validate GL accounts if changed
    await this.validateGLAccounts(
      { ...existing, ...validatedInput },
      organizationId
    );
    
    // Prevent changing item type for certain cases
    if (validatedInput.itemType && validatedInput.itemType !== existing.itemType) {
      // Check if item is used in assemblies/kits
      // TODO: Uncomment when assembliesKitsRepository is fixed
      // const isUsedInBOM = await assembliesKitsRepository.isItemUsedInBOM(id);
      // if (isUsedInBOM) {
      //   throw new ServiceError(
      //     'Cannot change item type when item is used in assemblies or kits',
      //     'ITEM_IN_USE',
      //     409
      //   );
      // }
    }
    
    const updateData: any = {
      ...validatedInput,
      updatedBy: userId,
    };
    
    // Convert numeric fields
    if (validatedInput.defaultPrice !== undefined) {
      updateData.defaultPrice = validatedInput.defaultPrice?.toString() || null;
    }
    if (validatedInput.defaultCost !== undefined) {
      updateData.defaultCost = validatedInput.defaultCost?.toString() || null;
    }
    if (validatedInput.weight !== undefined) {
      updateData.weight = validatedInput.weight?.toString() || null;
    }
    
    const updated = await itemsRepository.update(id, organizationId, updateData);
    
    if (!updated) {
      throw new ServiceError(
        'Failed to update item',
        'UPDATE_FAILED',
        500
      );
    }
    
    return this.transformItem(updated);
  }

  /**
   * Delete (deactivate) an item
   */
  async deleteItem(id: string): Promise<void> {
    const organizationId = this.requireOrganizationContext();
    
    try {
      await itemsRepository.delete(id, organizationId);
    } catch (error: any) {
      if (error.message.includes('variants')) {
        throw new ServiceError(
          'Cannot delete item with variants',
          'HAS_VARIANTS',
          409
        );
      }
      throw new ServiceError(
        'Failed to delete item',
        'DELETE_FAILED',
        500
      );
    }
  }

  /**
   * Generate variants for a parent item
   */
  async generateVariants(input: GenerateVariantsInput): Promise<Item[]> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate input
    const validatedInput = generateVariantsSchema.parse(input);
    
    try {
      const variants = await itemsRepository.generateVariants(
        validatedInput.parentItemId,
        organizationId,
        validatedInput.attributes as any
      );
      
      return variants.map(v => this.transformItem(v));
    } catch (error: any) {
      if (error.message.includes('Parent item not found')) {
        throw new ServiceError(
          'Parent item not found',
          'PARENT_NOT_FOUND',
          404
        );
      }
      if (error.message.includes('marked as parent')) {
        throw new ServiceError(
          'Item must be marked as parent to generate variants',
          'NOT_PARENT',
          400
        );
      }
      throw new ServiceError(
        'Failed to generate variants',
        'GENERATION_FAILED',
        500
      );
    }
  }

  /**
   * Search items
   */
  async searchItems(query: string): Promise<Item[]> {
    const organizationId = this.requireOrganizationContext();
    
    const items = await itemsRepository.findByOrganization(organizationId, {
      query,
      limit: 50,
    });
    
    return items.map(i => this.transformItem(i));
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(categoryId: string): Promise<Item[]> {
    const organizationId = this.requireOrganizationContext();
    
    const items = await itemsRepository.findByOrganization(organizationId, {
      categoryId,
    });
    
    return items.map(i => this.transformItem(i));
  }

  /**
   * Validate GL accounts based on item type
   */
  private async validateGLAccounts(
    item: any,
    organizationId: string
  ): Promise<void> {
    const requiredAccounts: string[] = [];
    
    switch (item.itemType) {
      case 'INVENTORY_ITEM':
        if (item.isSaleable && !item.incomeAccountId) {
          requiredAccounts.push('income account');
        }
        if (!item.assetAccountId) {
          requiredAccounts.push('asset account');
        }
        if (!item.cogsAccountId) {
          requiredAccounts.push('COGS account');
        }
        break;
        
      case 'NON_INVENTORY_ITEM':
        if (item.isSaleable && !item.incomeAccountId) {
          requiredAccounts.push('income account');
        }
        if (item.isPurchasable && !item.expenseAccountId) {
          requiredAccounts.push('expense account');
        }
        break;
        
      case 'SERVICE':
        if (item.isSaleable && !item.incomeAccountId) {
          requiredAccounts.push('income account');
        }
        if (item.isPurchasable && !item.expenseAccountId) {
          requiredAccounts.push('expense account');
        }
        break;
        
      case 'CHARGE':
      case 'DISCOUNT':
      case 'TAX':
        if (!item.incomeAccountId && !item.expenseAccountId) {
          requiredAccounts.push('income or expense account');
        }
        break;
    }
    
    if (requiredAccounts.length > 0) {
      throw new ServiceError(
        `Missing required accounts: ${requiredAccounts.join(', ')}`,
        'MISSING_GL_ACCOUNTS',
        400
      );
    }
    
    // Validate that account IDs exist
    const accountIds = [
      item.incomeAccountId,
      item.expenseAccountId,
      item.assetAccountId,
      item.cogsAccountId,
    ].filter(Boolean);
    
    for (const accountId of accountIds) {
      const account = await accountRepository.findById(accountId, organizationId);
      if (!account) {
        throw new ServiceError(
          'Invalid GL account',
          'INVALID_GL_ACCOUNT',
          400
        );
      }
    }
  }
}