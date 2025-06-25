import { and, eq, ilike, or, inArray, isNull, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { items } from '../db/schema/items';
import type { Item, NewItem } from '../db/schema/items';

export interface ItemSearchParams {
  query?: string;
  itemType?: string;
  categoryId?: string;
  isActive?: boolean;
  isPurchasable?: boolean;
  isSaleable?: boolean;
  parentItemId?: string | null;
  includeVariants?: boolean;
  limit?: number;
  offset?: number;
}

export interface VariantAttribute {
  name: string;
  values: string[];
}

export class ItemsRepository extends BaseRepository {
  /**
   * Find all items for an organization
   */
  async findByOrganization(organizationId: string, params: ItemSearchParams = {}) {
    let query = this.db
      .select()
      .from(items);

    // Apply filters
    const conditions = [eq(items.organizationId, organizationId)];

    if (params.query) {
      conditions.push(
        or(
          ilike(items.name, `%${params.query}%`),
          ilike(items.itemCode, `%${params.query}%`),
          ilike(items.sku, `%${params.query}%`),
          ilike(items.upc, `%${params.query}%`)
        )!
      );
    }

    if (params.itemType) {
      conditions.push(eq(items.itemType, params.itemType as any));
    }

    if (params.categoryId) {
      conditions.push(eq(items.categoryId, params.categoryId));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(items.isActive, params.isActive));
    }

    if (params.isPurchasable !== undefined) {
      conditions.push(eq(items.isPurchasable, params.isPurchasable));
    }

    if (params.isSaleable !== undefined) {
      conditions.push(eq(items.isSaleable, params.isSaleable));
    }

    if (params.parentItemId !== undefined) {
      if (params.parentItemId === null) {
        conditions.push(isNull(items.parentItemId));
      } else {
        conditions.push(eq(items.parentItemId, params.parentItemId));
      }
    }

    if (!params.includeVariants) {
      conditions.push(eq(items.isParent, false));
    }

    query = query.where(and(...conditions));

    // Apply pagination
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.offset(params.offset);
    }

    return await query.orderBy(items.itemCode);
  }

  /**
   * Find an item by ID
   */
  async findById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.id, id),
          eq(items.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find an item by code
   */
  async findByCode(code: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.itemCode, code),
          eq(items.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find an item by SKU
   */
  async findBySku(sku: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.sku, sku),
          eq(items.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find all variants of a parent item
   */
  async findVariants(parentItemId: string, organizationId: string) {
    return await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.organizationId, organizationId),
          eq(items.parentItemId, parentItemId)
        )
      )
      .orderBy(items.itemCode);
  }

  /**
   * Create a new item
   */
  async create(data: NewItem) {
    const results = await this.db
      .insert(items)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Create multiple items (for bulk variant creation)
   */
  async createMany(data: NewItem[]) {
    return await this.db
      .insert(items)
      .values(data)
      .returning();
  }

  /**
   * Update an item
   */
  async update(id: string, organizationId: string, data: Partial<NewItem>) {
    const results = await this.db
      .update(items)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(items.id, id),
          eq(items.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Soft delete an item
   */
  async delete(id: string, organizationId: string) {
    // Check if item has variants
    const variants = await this.findVariants(id, organizationId);
    if (variants.length > 0) {
      throw new Error('Cannot delete item with variants');
    }

    // Check if item is used in transactions
    // TODO: Add check when transaction tables are implemented

    const results = await this.db
      .update(items)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(items.id, id),
          eq(items.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Generate variants for a parent item
   */
  async generateVariants(
    parentItemId: string,
    organizationId: string,
    attributes: VariantAttribute[]
  ): Promise<Item[]> {
    const parentItem = await this.findById(parentItemId, organizationId);
    if (!parentItem) {
      throw new Error('Parent item not found');
    }

    if (!parentItem.isParent) {
      throw new Error('Item must be marked as parent to generate variants');
    }

    // Generate all combinations
    const combinations = this.generateCombinations(attributes);
    const variants: NewItem[] = [];

    for (const combination of combinations) {
      const variantCode = this.generateVariantCode(parentItem.itemCode, combination);
      const variantName = this.generateVariantName(parentItem.name, combination);

      variants.push({
        organizationId,
        itemCode: variantCode,
        name: variantName,
        description: parentItem.description,
        itemType: parentItem.itemType,
        isParent: false,
        parentItemId: parentItemId,
        variantAttributes: combination,
        categoryId: parentItem.categoryId,
        unitOfMeasureId: parentItem.unitOfMeasureId,
        incomeAccountId: parentItem.incomeAccountId,
        expenseAccountId: parentItem.expenseAccountId,
        assetAccountId: parentItem.assetAccountId,
        cogsAccountId: parentItem.cogsAccountId,
        defaultPrice: parentItem.defaultPrice,
        defaultCost: parentItem.defaultCost,
        isTaxable: parentItem.isTaxable,
        taxCode: parentItem.taxCode,
        isActive: true,
        isPurchasable: parentItem.isPurchasable,
        isSaleable: parentItem.isSaleable,
        trackQuantity: parentItem.trackQuantity,
        trackLotNumbers: parentItem.trackLotNumbers,
        trackSerialNumbers: parentItem.trackSerialNumbers,
        weight: parentItem.weight,
        weightUnit: parentItem.weightUnit,
      });
    }

    return await this.createMany(variants);
  }

  /**
   * Generate all combinations of variant attributes
   */
  private generateCombinations(attributes: VariantAttribute[]): Record<string, string>[] {
    if (attributes.length === 0) return [{}];

    const [first, ...rest] = attributes;
    const restCombinations = this.generateCombinations(rest);
    const combinations: Record<string, string>[] = [];

    for (const value of first.values) {
      for (const restCombo of restCombinations) {
        combinations.push({
          [first.name]: value,
          ...restCombo,
        });
      }
    }

    return combinations;
  }

  /**
   * Generate variant code from parent code and attributes
   */
  private generateVariantCode(parentCode: string, attributes: Record<string, string>): string {
    const suffix = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, value]) => value.substring(0, 3).toUpperCase())
      .join('-');
    
    return `${parentCode}-${suffix}`;
  }

  /**
   * Generate variant name from parent name and attributes
   */
  private generateVariantName(parentName: string, attributes: Record<string, string>): string {
    const attributeString = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${value}`)
      .join(' / ');
    
    return `${parentName} - ${attributeString}`;
  }

  /**
   * Get items by IDs
   */
  async findByIds(ids: string[], organizationId: string) {
    if (ids.length === 0) return [];

    return await this.db
      .select()
      .from(items)
      .where(
        and(
          eq(items.organizationId, organizationId),
          inArray(items.id, ids)
        )
      );
  }

  /**
   * Check if an item can be purchased
   */
  async canBePurchased(itemId: string, organizationId: string): Promise<boolean> {
    const item = await this.findById(itemId, organizationId);
    return item ? item.isPurchasable && item.isActive : false;
  }

  /**
   * Check if an item can be sold
   */
  async canBeSold(itemId: string, organizationId: string): Promise<boolean> {
    const item = await this.findById(itemId, organizationId);
    return item ? item.isSaleable && item.isActive : false;
  }

  /**
   * Get item count by category
   */
  async getCountByCategory(categoryId: string, organizationId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(
        and(
          eq(items.organizationId, organizationId),
          eq(items.categoryId, categoryId)
        )
      );

    return result[0]?.count || 0;
  }
}