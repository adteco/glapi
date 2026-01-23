import { and, eq, gte, lte, or, isNull, desc, asc, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { priceLists, itemPricing, customerPriceLists, priceListLaborRates } from '../db/schema/pricing';
import { items } from '../db/schema/items';
import { entities } from '../db/schema/entities';
import { projects, projectCostCodes } from '../db/schema/projects';
import type { PriceList, NewPriceList, ItemPricing, NewItemPricing, CustomerPriceList, NewCustomerPriceList, PriceListLaborRate, NewPriceListLaborRate } from '../db/schema/pricing';

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

export interface PriceListLaborRateFilters {
  employeeId?: string;
  laborRole?: string;
  projectId?: string;
  costCodeId?: string;
  activeOnly?: boolean;
}

export interface BillingRateCalculationParams {
  customerId?: string;
  employeeId?: string;
  laborRole?: string;
  projectId?: string;
  costCodeId?: string;
  date?: Date;
  organizationId: string;
}

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
  matchedOn: {
    employee: boolean;
    laborRole: boolean;
    project: boolean;
    costCode: boolean;
  };
}

export class PricingRepository extends BaseRepository {
  // Price List Methods
  
  /**
   * Find all price lists for an organization
   */
  async findPriceLists(organizationId: string, activeOnly = true) {
    const conditions = [eq(priceLists.organizationId, organizationId)];
    
    if (activeOnly) {
      conditions.push(eq(priceLists.isActive, true));
    }

    return await this.db
      .select()
      .from(priceLists)
      .where(and(...conditions))
      .orderBy(priceLists.name);
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
    const conditions = [eq(itemPricing.itemId, itemId)];
    
    if (priceListId) {
      conditions.push(eq(itemPricing.priceListId, priceListId));
    }

    return await this.db
      .select()
      .from(itemPricing)
      .where(and(...conditions))
      .orderBy(itemPricing.minQuantity);
  }

  /**
   * Find all items in a price list
   */
  async findPriceListItems(priceListId: string) {
    const results = await this.db
      .select({
        id: itemPricing.id,
        itemId: itemPricing.itemId,
        priceListId: itemPricing.priceListId,
        unitPrice: itemPricing.unitPrice,
        minQuantity: itemPricing.minQuantity,
        effectiveDate: itemPricing.effectiveDate,
        expirationDate: itemPricing.expirationDate,
        createdAt: itemPricing.createdAt,
        updatedAt: itemPricing.updatedAt,
        item: {
          id: items.id,
          itemCode: items.itemCode,
          name: items.name,
          description: items.description,
          defaultPrice: items.defaultPrice,
          isActive: items.isActive,
        },
      })
      .from(itemPricing)
      .leftJoin(items, eq(itemPricing.itemId, items.id))
      .where(eq(itemPricing.priceListId, priceListId))
      .orderBy(itemPricing.itemId, itemPricing.minQuantity);
    
    return results;
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
    const applicablePriceLists: PriceList[] = [];

    // If customer is provided, get their assigned price lists
    if (customerId) {
      const customerAssignments = await this.db
        .select()
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
        applicablePriceLists.push(row.price_lists);
      }
    }

    // Always include the default price list as fallback
    const defaultPriceList = await this.getDefaultPriceList(organizationId);
    if (defaultPriceList && !applicablePriceLists.find(pl => pl.id === defaultPriceList.id)) {
      applicablePriceLists.push(defaultPriceList);
    }

    return applicablePriceLists;
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
          lte(itemPricing.minQuantity, quantity.toString()),
          lte(itemPricing.effectiveDate, date.toISOString().split('T')[0]),
          or(
            isNull(itemPricing.expirationDate),
            gte(itemPricing.expirationDate, date.toISOString().split('T')[0])
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
      minQuantity: price.minQuantity ? parseFloat(price.minQuantity) : 0,
      effectiveDate: new Date(price.effectiveDate),
      expirationDate: price.expirationDate ? new Date(price.expirationDate) : null,
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

  // ============================================================================
  // Price List Labor Rates Methods
  // ============================================================================

  /**
   * Find all labor rates for a price list
   */
  async findPriceListLaborRates(priceListId: string, filters: PriceListLaborRateFilters = {}) {
    const conditions = [eq(priceListLaborRates.priceListId, priceListId)];
    const today = new Date().toISOString().split('T')[0];

    if (filters.employeeId) {
      conditions.push(eq(priceListLaborRates.employeeId, filters.employeeId));
    }
    if (filters.laborRole) {
      conditions.push(eq(priceListLaborRates.laborRole, filters.laborRole));
    }
    if (filters.projectId) {
      conditions.push(eq(priceListLaborRates.projectId, filters.projectId));
    }
    if (filters.costCodeId) {
      conditions.push(eq(priceListLaborRates.costCodeId, filters.costCodeId));
    }
    if (filters.activeOnly) {
      conditions.push(lte(priceListLaborRates.effectiveDate, today));
      conditions.push(
        or(
          isNull(priceListLaborRates.expirationDate),
          gte(priceListLaborRates.expirationDate, today)
        )!
      );
    }

    const results = await this.db
      .select({
        id: priceListLaborRates.id,
        priceListId: priceListLaborRates.priceListId,
        employeeId: priceListLaborRates.employeeId,
        laborRole: priceListLaborRates.laborRole,
        projectId: priceListLaborRates.projectId,
        costCodeId: priceListLaborRates.costCodeId,
        laborRate: priceListLaborRates.laborRate,
        burdenRate: priceListLaborRates.burdenRate,
        billingRate: priceListLaborRates.billingRate,
        overtimeMultiplier: priceListLaborRates.overtimeMultiplier,
        doubleTimeMultiplier: priceListLaborRates.doubleTimeMultiplier,
        priority: priceListLaborRates.priority,
        effectiveDate: priceListLaborRates.effectiveDate,
        expirationDate: priceListLaborRates.expirationDate,
        description: priceListLaborRates.description,
        createdAt: priceListLaborRates.createdAt,
        updatedAt: priceListLaborRates.updatedAt,
        employee: {
          id: entities.id,
          displayName: entities.displayName,
          email: entities.email,
        },
        project: {
          id: projects.id,
          name: projects.name,
          projectCode: projects.projectCode,
        },
        costCode: {
          id: projectCostCodes.id,
          costCode: projectCostCodes.costCode,
          name: projectCostCodes.name,
        },
      })
      .from(priceListLaborRates)
      .leftJoin(entities, eq(priceListLaborRates.employeeId, entities.id))
      .leftJoin(projects, eq(priceListLaborRates.projectId, projects.id))
      .leftJoin(projectCostCodes, eq(priceListLaborRates.costCodeId, projectCostCodes.id))
      .where(and(...conditions))
      .orderBy(desc(priceListLaborRates.priority), priceListLaborRates.laborRole, priceListLaborRates.effectiveDate);

    return results;
  }

  /**
   * Find a single labor rate by ID
   */
  async findLaborRateById(id: string) {
    const results = await this.db
      .select({
        id: priceListLaborRates.id,
        priceListId: priceListLaborRates.priceListId,
        employeeId: priceListLaborRates.employeeId,
        laborRole: priceListLaborRates.laborRole,
        projectId: priceListLaborRates.projectId,
        costCodeId: priceListLaborRates.costCodeId,
        laborRate: priceListLaborRates.laborRate,
        burdenRate: priceListLaborRates.burdenRate,
        billingRate: priceListLaborRates.billingRate,
        overtimeMultiplier: priceListLaborRates.overtimeMultiplier,
        doubleTimeMultiplier: priceListLaborRates.doubleTimeMultiplier,
        priority: priceListLaborRates.priority,
        effectiveDate: priceListLaborRates.effectiveDate,
        expirationDate: priceListLaborRates.expirationDate,
        description: priceListLaborRates.description,
        createdAt: priceListLaborRates.createdAt,
        updatedAt: priceListLaborRates.updatedAt,
        employee: {
          id: entities.id,
          displayName: entities.displayName,
          email: entities.email,
        },
        project: {
          id: projects.id,
          name: projects.name,
          projectCode: projects.projectCode,
        },
        costCode: {
          id: projectCostCodes.id,
          costCode: projectCostCodes.costCode,
          name: projectCostCodes.name,
        },
      })
      .from(priceListLaborRates)
      .leftJoin(entities, eq(priceListLaborRates.employeeId, entities.id))
      .leftJoin(projects, eq(priceListLaborRates.projectId, projects.id))
      .leftJoin(projectCostCodes, eq(priceListLaborRates.costCodeId, projectCostCodes.id))
      .where(eq(priceListLaborRates.id, id));

    return results[0] || null;
  }

  /**
   * Create a labor rate
   */
  async createPriceListLaborRate(data: NewPriceListLaborRate) {
    const results = await this.db
      .insert(priceListLaborRates)
      .values(data)
      .returning();

    return results[0];
  }

  /**
   * Update a labor rate
   */
  async updatePriceListLaborRate(id: string, data: Partial<NewPriceListLaborRate>) {
    const results = await this.db
      .update(priceListLaborRates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(priceListLaborRates.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Delete a labor rate
   */
  async deletePriceListLaborRate(id: string) {
    const results = await this.db
      .delete(priceListLaborRates)
      .where(eq(priceListLaborRates.id, id))
      .returning();

    return results[0] || null;
  }

  /**
   * Calculate the billing rate for a given set of parameters
   * Priority order:
   * 1. Customer's assigned price lists (by customerPriceLists.priority)
   * 2. Within each list, match by specificity (employee+project+costCode > employee+project > employee > role > default)
   * 3. Filter by effective dates
   * 4. Fall back to organization's default price list
   */
  async calculateBillingRate(params: BillingRateCalculationParams): Promise<CalculatedBillingRate | null> {
    const { customerId, employeeId, laborRole, projectId, costCodeId, date = new Date(), organizationId } = params;
    const dateStr = date.toISOString().split('T')[0];

    // Get applicable price lists
    const applicablePriceLists = await this.getApplicablePriceLists(customerId, organizationId);

    if (applicablePriceLists.length === 0) {
      return null;
    }

    // Try to find a matching rate in each price list (by priority order)
    for (const priceList of applicablePriceLists) {
      const rate = await this.findBestMatchingLaborRate(
        priceList.id,
        employeeId,
        laborRole,
        projectId,
        costCodeId,
        dateStr
      );

      if (rate) {
        return {
          laborRate: parseFloat(rate.laborRate),
          burdenRate: parseFloat(rate.burdenRate),
          billingRate: parseFloat(rate.billingRate),
          overtimeMultiplier: parseFloat(rate.overtimeMultiplier),
          doubleTimeMultiplier: parseFloat(rate.doubleTimeMultiplier),
          priceListId: priceList.id,
          priceListName: priceList.name,
          laborRateId: rate.id,
          effectiveDate: new Date(rate.effectiveDate),
          expirationDate: rate.expirationDate ? new Date(rate.expirationDate) : null,
          matchedOn: {
            employee: rate.employeeId !== null && rate.employeeId === employeeId,
            laborRole: rate.laborRole !== null && rate.laborRole === laborRole,
            project: rate.projectId !== null && rate.projectId === projectId,
            costCode: rate.costCodeId !== null && rate.costCodeId === costCodeId,
          },
        };
      }
    }

    return null;
  }

  /**
   * Find the best matching labor rate within a price list
   * Matches are scored by specificity - more specific matches win
   */
  private async findBestMatchingLaborRate(
    priceListId: string,
    employeeId?: string,
    laborRole?: string,
    projectId?: string,
    costCodeId?: string,
    dateStr?: string
  ): Promise<PriceListLaborRate | null> {
    const currentDate = dateStr || new Date().toISOString().split('T')[0];

    // Build conditions for date filtering
    const baseConditions = [
      eq(priceListLaborRates.priceListId, priceListId),
      lte(priceListLaborRates.effectiveDate, currentDate),
      or(
        isNull(priceListLaborRates.expirationDate),
        gte(priceListLaborRates.expirationDate, currentDate)
      )!,
    ];

    // Build all possible matching conditions, ordered by specificity (most specific first)
    const matchingStrategies: Array<typeof baseConditions> = [];

    // 1. Exact match on all provided criteria
    if (employeeId && projectId && costCodeId) {
      matchingStrategies.push([
        ...baseConditions,
        eq(priceListLaborRates.employeeId, employeeId),
        eq(priceListLaborRates.projectId, projectId),
        eq(priceListLaborRates.costCodeId, costCodeId),
      ]);
    }

    // 2. Employee + Project (no cost code)
    if (employeeId && projectId) {
      matchingStrategies.push([
        ...baseConditions,
        eq(priceListLaborRates.employeeId, employeeId),
        eq(priceListLaborRates.projectId, projectId),
        isNull(priceListLaborRates.costCodeId),
      ]);
    }

    // 3. Employee + Cost Code (no project)
    if (employeeId && costCodeId) {
      matchingStrategies.push([
        ...baseConditions,
        eq(priceListLaborRates.employeeId, employeeId),
        isNull(priceListLaborRates.projectId),
        eq(priceListLaborRates.costCodeId, costCodeId),
      ]);
    }

    // 4. Employee only
    if (employeeId) {
      matchingStrategies.push([
        ...baseConditions,
        eq(priceListLaborRates.employeeId, employeeId),
        isNull(priceListLaborRates.projectId),
        isNull(priceListLaborRates.costCodeId),
      ]);
    }

    // 5. Labor Role + Project + Cost Code
    if (laborRole && projectId && costCodeId) {
      matchingStrategies.push([
        ...baseConditions,
        isNull(priceListLaborRates.employeeId),
        eq(priceListLaborRates.laborRole, laborRole),
        eq(priceListLaborRates.projectId, projectId),
        eq(priceListLaborRates.costCodeId, costCodeId),
      ]);
    }

    // 6. Labor Role + Project
    if (laborRole && projectId) {
      matchingStrategies.push([
        ...baseConditions,
        isNull(priceListLaborRates.employeeId),
        eq(priceListLaborRates.laborRole, laborRole),
        eq(priceListLaborRates.projectId, projectId),
        isNull(priceListLaborRates.costCodeId),
      ]);
    }

    // 7. Labor Role only
    if (laborRole) {
      matchingStrategies.push([
        ...baseConditions,
        isNull(priceListLaborRates.employeeId),
        eq(priceListLaborRates.laborRole, laborRole),
        isNull(priceListLaborRates.projectId),
        isNull(priceListLaborRates.costCodeId),
      ]);
    }

    // 8. Project + Cost Code (generic rate for project/cost code)
    if (projectId && costCodeId) {
      matchingStrategies.push([
        ...baseConditions,
        isNull(priceListLaborRates.employeeId),
        isNull(priceListLaborRates.laborRole),
        eq(priceListLaborRates.projectId, projectId),
        eq(priceListLaborRates.costCodeId, costCodeId),
      ]);
    }

    // 9. Project only
    if (projectId) {
      matchingStrategies.push([
        ...baseConditions,
        isNull(priceListLaborRates.employeeId),
        isNull(priceListLaborRates.laborRole),
        eq(priceListLaborRates.projectId, projectId),
        isNull(priceListLaborRates.costCodeId),
      ]);
    }

    // 10. Default rate (no targeting)
    matchingStrategies.push([
      ...baseConditions,
      isNull(priceListLaborRates.employeeId),
      isNull(priceListLaborRates.laborRole),
      isNull(priceListLaborRates.projectId),
      isNull(priceListLaborRates.costCodeId),
    ]);

    // Try each strategy in order (most specific first)
    for (const conditions of matchingStrategies) {
      const results = await this.db
        .select()
        .from(priceListLaborRates)
        .where(and(...conditions))
        .orderBy(desc(priceListLaborRates.priority))
        .limit(1);

      if (results.length > 0) {
        return results[0];
      }
    }

    return null;
  }

  /**
   * Copy labor rates from one price list to another
   */
  async copyLaborRates(
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

    // Get all labor rates from source
    const sourceRates = await this.findPriceListLaborRates(sourcePriceListId, { activeOnly: false });

    // Create copies for target
    const newRates = sourceRates.map(rate => ({
      priceListId: targetPriceListId,
      employeeId: rate.employeeId,
      laborRole: rate.laborRole,
      projectId: rate.projectId,
      costCodeId: rate.costCodeId,
      laborRate: rate.laborRate,
      burdenRate: rate.burdenRate,
      billingRate: rate.billingRate,
      overtimeMultiplier: rate.overtimeMultiplier,
      doubleTimeMultiplier: rate.doubleTimeMultiplier,
      priority: rate.priority,
      effectiveDate: rate.effectiveDate,
      expirationDate: rate.expirationDate,
      description: rate.description,
    }));

    if (newRates.length === 0) {
      return [];
    }

    return await this.db
      .insert(priceListLaborRates)
      .values(newRates)
      .returning();
  }
}