import { and, eq, gte, lte, or, isNull, desc, asc, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { priceLists, itemPricing, customerPriceLists } from '../db/schema/pricing';
import type { PriceList, NewPriceList, ItemPricing, NewItemPricing, CustomerPriceList, NewCustomerPriceList } from '../db/schema/pricing';

export interface PriceCalculationParams {
  itemId: string;
  customerId?: string;
  quantity: number;
  date?: Date;
  organizationId: string;
}

export interface CalculatedPrice {
  unitPrice: number;
  priceListId: string;
  priceListName: string;
  minQuantity: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

export class PricingRepository extends BaseRepository {
  // Price List Methods
  
  /**
   * Find all price lists for an organization
   */
  async findPriceLists(organizationId: string, activeOnly = true) {
    let query = this.db
      .select()
      .from(priceLists)
      .where(eq(priceLists.organizationId, organizationId));

    if (activeOnly) {
      query = query.where(
        and(
          eq(priceLists.organizationId, organizationId),
          eq(priceLists.isActive, true)
        )
      );
    }

    return await query.orderBy(priceLists.name);
  }

  /**
   * Find a price list by ID
   */
  async findPriceListById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(priceLists)
      .where(
        and(
          eq(priceLists.id, id),
          eq(priceLists.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a price list by code
   */
  async findPriceListByCode(code: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(priceLists)
      .where(
        and(
          eq(priceLists.code, code),
          eq(priceLists.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Get the default price list
   */
  async getDefaultPriceList(organizationId: string) {
    const results = await this.db
      .select()
      .from(priceLists)
      .where(
        and(
          eq(priceLists.organizationId, organizationId),
          eq(priceLists.isDefault, true)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Create a price list
   */
  async createPriceList(data: NewPriceList) {
    // If this is marked as default, unset other defaults
    if (data.isDefault) {
      await this.db
        .update(priceLists)
        .set({ isDefault: false })
        .where(
          and(
            eq(priceLists.organizationId, data.organizationId),
            eq(priceLists.isDefault, true)
          )
        );
    }

    const results = await this.db
      .insert(priceLists)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a price list
   */
  async updatePriceList(id: string, organizationId: string, data: Partial<NewPriceList>) {
    // If setting as default, unset other defaults
    if (data.isDefault === true) {
      await this.db
        .update(priceLists)
        .set({ isDefault: false })
        .where(
          and(
            eq(priceLists.organizationId, organizationId),
            eq(priceLists.isDefault, true),
            sql`${priceLists.id} != ${id}`
          )
        );
    }

    const results = await this.db
      .update(priceLists)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(priceLists.id, id),
          eq(priceLists.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete a price list
   */
  async deletePriceList(id: string, organizationId: string) {
    // Check if price list is in use
    const itemPricingCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(itemPricing)
      .where(eq(itemPricing.priceListId, id));

    if (itemPricingCount[0]?.count > 0) {
      throw new Error('Cannot delete price list with associated item prices');
    }

    const results = await this.db
      .update(priceLists)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(priceLists.id, id),
          eq(priceLists.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  // Item Pricing Methods

  /**
   * Find all prices for an item
   */
  async findItemPrices(itemId: string, priceListId?: string) {
    let query = this.db
      .select()
      .from(itemPricing)
      .where(eq(itemPricing.itemId, itemId));

    if (priceListId) {
      query = query.where(
        and(
          eq(itemPricing.itemId, itemId),
          eq(itemPricing.priceListId, priceListId)
        )
      );
    }

    return await query.orderBy(itemPricing.minQuantity);
  }

  /**
   * Find all items in a price list
   */
  async findPriceListItems(priceListId: string) {
    return await this.db
      .select()
      .from(itemPricing)
      .where(eq(itemPricing.priceListId, priceListId))
      .orderBy(itemPricing.itemId, itemPricing.minQuantity);
  }

  /**
   * Create item pricing
   */
  async createItemPricing(data: NewItemPricing) {
    const results = await this.db
      .insert(itemPricing)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Create multiple item prices (bulk)
   */
  async createManyItemPrices(data: NewItemPricing[]) {
    return await this.db
      .insert(itemPricing)
      .values(data)
      .returning();
  }

  /**
   * Update item pricing
   */
  async updateItemPricing(id: string, data: Partial<NewItemPricing>) {
    const results = await this.db
      .update(itemPricing)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(itemPricing.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete item pricing
   */
  async deleteItemPricing(id: string) {
    const results = await this.db
      .delete(itemPricing)
      .where(eq(itemPricing.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete all prices for an item in a price list
   */
  async deleteItemFromPriceList(itemId: string, priceListId: string) {
    return await this.db
      .delete(itemPricing)
      .where(
        and(
          eq(itemPricing.itemId, itemId),
          eq(itemPricing.priceListId, priceListId)
        )
      );
  }

  // Customer Price List Methods

  /**
   * Find price lists assigned to a customer
   */
  async findCustomerPriceLists(customerId: string) {
    return await this.db
      .select()
      .from(customerPriceLists)
      .where(eq(customerPriceLists.customerId, customerId))
      .orderBy(customerPriceLists.priority);
  }

  /**
   * Assign a price list to a customer
   */
  async assignPriceListToCustomer(data: NewCustomerPriceList) {
    const results = await this.db
      .insert(customerPriceLists)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update customer price list assignment
   */
  async updateCustomerPriceList(id: string, data: Partial<NewCustomerPriceList>) {
    const results = await this.db
      .update(customerPriceLists)
      .set(data)
      .where(eq(customerPriceLists.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Remove price list from customer
   */
  async removeCustomerPriceList(customerId: string, priceListId: string) {
    return await this.db
      .delete(customerPriceLists)
      .where(
        and(
          eq(customerPriceLists.customerId, customerId),
          eq(customerPriceLists.priceListId, priceListId)
        )
      );
  }

  // Price Calculation Methods

  /**
   * Calculate the price for an item based on customer, quantity, and date
   */
  async calculatePrice(params: PriceCalculationParams): Promise<CalculatedPrice | null> {
    const { itemId, customerId, quantity, date = new Date(), organizationId } = params;

    // Get applicable price lists
    const applicablePriceLists = await this.getApplicablePriceLists(customerId, organizationId);
    
    if (applicablePriceLists.length === 0) {
      return null;
    }

    // Find the best price across all applicable price lists
    let bestPrice: CalculatedPrice | null = null;

    for (const priceList of applicablePriceLists) {
      const price = await this.getItemPriceFromList(
        itemId,
        priceList.id,
        quantity,
        date
      );

      if (price) {
        // Add price list info
        const calculatedPrice: CalculatedPrice = {
          ...price,
          priceListId: priceList.id,
          priceListName: priceList.name,
        };

        // Keep the lowest price
        if (!bestPrice || calculatedPrice.unitPrice < bestPrice.unitPrice) {
          bestPrice = calculatedPrice;
        }
      }
    }

    return bestPrice;
  }

  /**
   * Get applicable price lists for a customer
   */
  private async getApplicablePriceLists(
    customerId: string | undefined,
    organizationId: string
  ): Promise<PriceList[]> {
    const priceLists: PriceList[] = [];

    // If customer is provided, get their assigned price lists
    if (customerId) {
      const customerAssignments = await this.db
        .select({
          priceList: priceLists,
          assignment: customerPriceLists,
        })
        .from(customerPriceLists)
        .innerJoin(
          priceLists,
          eq(customerPriceLists.priceListId, priceLists.id)
        )
        .where(
          and(
            eq(customerPriceLists.customerId, customerId),
            eq(priceLists.isActive, true)
          )
        )
        .orderBy(customerPriceLists.priority);

      for (const row of customerAssignments) {
        priceLists.push(row.priceList);
      }
    }

    // Always include the default price list as fallback
    const defaultPriceList = await this.getDefaultPriceList(organizationId);
    if (defaultPriceList && !priceLists.find(pl => pl.id === defaultPriceList.id)) {
      priceLists.push(defaultPriceList);
    }

    return priceLists;
  }

  /**
   * Get item price from a specific price list
   */
  private async getItemPriceFromList(
    itemId: string,
    priceListId: string,
    quantity: number,
    date: Date
  ): Promise<Omit<CalculatedPrice, 'priceListId' | 'priceListName'> | null> {
    const results = await this.db
      .select()
      .from(itemPricing)
      .where(
        and(
          eq(itemPricing.itemId, itemId),
          eq(itemPricing.priceListId, priceListId),
          lte(itemPricing.minQuantity, quantity),
          lte(itemPricing.effectiveDate, date),
          or(
            isNull(itemPricing.expirationDate),
            gte(itemPricing.expirationDate, date)
          )
        )
      )
      .orderBy(desc(itemPricing.minQuantity))
      .limit(1);

    const price = results[0];
    if (!price) {
      return null;
    }

    return {
      unitPrice: parseFloat(price.unitPrice),
      minQuantity: parseFloat(price.minQuantity),
      effectiveDate: price.effectiveDate,
      expirationDate: price.expirationDate,
    };
  }

  /**
   * Copy prices from one price list to another
   */
  async copyPrices(
    sourcePriceListId: string,
    targetPriceListId: string,
    organizationId: string
  ) {
    // Verify both price lists belong to the organization
    const source = await this.findPriceListById(sourcePriceListId, organizationId);
    const target = await this.findPriceListById(targetPriceListId, organizationId);

    if (!source || !target) {
      throw new Error('Price list not found');
    }

    // Get all prices from source
    const sourcePrices = await this.findPriceListItems(sourcePriceListId);

    // Create copies for target
    const newPrices = sourcePrices.map(price => ({
      itemId: price.itemId,
      priceListId: targetPriceListId,
      unitPrice: price.unitPrice,
      minQuantity: price.minQuantity,
      effectiveDate: price.effectiveDate,
      expirationDate: price.expirationDate,
    }));

    return await this.createManyItemPrices(newPrices);
  }
}