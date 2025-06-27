import { and, eq, isNull, or, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { warehouses, warehousePriceLists, customerWarehouseAssignments } from '../db/schema/warehouses';
import { priceLists, itemPricing } from '../db/schema/pricing';
import { items } from '../db/schema/items';
import { entities } from '../db/schema/entities';
import type { 
  Warehouse, 
  NewWarehouse, 
  WarehousePriceList, 
  NewWarehousePriceList,
  CustomerWarehouseAssignment,
  NewCustomerWarehouseAssignment
} from '../db/schema/warehouses';

export interface WarehousePriceParams {
  customerId: string;
  itemId: string;
  organizationId: string;
  date?: Date;
  quantity?: number;
}

export interface WarehousePriceResult {
  warehouseId: string;
  warehouseName: string;
  priceListId: string;
  priceListName: string;
  unitPrice: number;
  minQuantity: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
}

export class WarehouseRepository extends BaseRepository {
  /**
   * Find all warehouses for an organization
   */
  async findWarehouses(organizationId: string, activeOnly = true) {
    const conditions = [eq(warehouses.organizationId, organizationId)];
    
    if (activeOnly) {
      conditions.push(eq(warehouses.isActive, true));
    }

    const query = this.db
      .select()
      .from(warehouses)
      .where(and(...conditions));

    return await query.orderBy(warehouses.name);
  }

  /**
   * Find a warehouse by ID
   */
  async findWarehouseById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, id),
          eq(warehouses.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a warehouse by warehouse ID
   */
  async findWarehouseByCode(warehouseId: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.warehouseId, warehouseId),
          eq(warehouses.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(data: NewWarehouse): Promise<Warehouse> {
    const results = await this.db
      .insert(warehouses)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a warehouse
   */
  async updateWarehouse(id: string, organizationId: string, data: Partial<NewWarehouse>): Promise<Warehouse | null> {
    // Verify ownership
    const belongsToOrg = await this.belongsToOrganization(warehouses, id, organizationId);
    if (!belongsToOrg) {
      return null;
    }

    const results = await this.db
      .update(warehouses)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(warehouses.id, id),
          eq(warehouses.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete a warehouse
   */
  async deleteWarehouse(id: string, organizationId: string): Promise<boolean> {
    // Verify ownership
    const belongsToOrg = await this.belongsToOrganization(warehouses, id, organizationId);
    if (!belongsToOrg) {
      return false;
    }

    const result = await this.db
      .delete(warehouses)
      .where(
        and(
          eq(warehouses.id, id),
          eq(warehouses.organizationId, organizationId)
        )
      );
    
    return true;
  }

  // Warehouse Price List Methods

  /**
   * Assign price lists to a warehouse
   */
  async assignPriceListToWarehouse(data: NewWarehousePriceList): Promise<WarehousePriceList> {
    const results = await this.db
      .insert(warehousePriceLists)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Find all price lists for a warehouse
   */
  async findWarehousePriceLists(warehouseId: string, date?: Date) {
    const conditions = [eq(warehousePriceLists.warehouseId, warehouseId)];
    
    if (date) {
      conditions.push(
        or(
          isNull(warehousePriceLists.effectiveDate),
          lte(warehousePriceLists.effectiveDate, date.toISOString().split('T')[0])
        ),
        or(
          isNull(warehousePriceLists.expirationDate),
          gte(warehousePriceLists.expirationDate, date.toISOString().split('T')[0])
        )
      );
    }

    const query = this.db
      .select({
        warehousePriceList: warehousePriceLists,
        priceList: priceLists
      })
      .from(warehousePriceLists)
      .innerJoin(priceLists, eq(warehousePriceLists.priceListId, priceLists.id))
      .where(and(...conditions));

    return await query.orderBy(warehousePriceLists.priority);
  }

  /**
   * Remove a price list from a warehouse
   */
  async removePriceListFromWarehouse(warehouseId: string, priceListId: string): Promise<boolean> {
    await this.db
      .delete(warehousePriceLists)
      .where(
        and(
          eq(warehousePriceLists.warehouseId, warehouseId),
          eq(warehousePriceLists.priceListId, priceListId)
        )
      );
    
    return true;
  }

  // Customer Warehouse Assignment Methods

  /**
   * Assign a customer to a warehouse for a specific item
   */
  async assignCustomerToWarehouse(data: NewCustomerWarehouseAssignment): Promise<CustomerWarehouseAssignment> {
    const results = await this.db
      .insert(customerWarehouseAssignments)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Find customer's warehouse assignment for an item
   */
  async findCustomerWarehouseAssignment(
    customerId: string, 
    itemId: string, 
    organizationId: string,
    date?: Date
  ) {
    const conditions = [
      eq(customerWarehouseAssignments.organizationId, organizationId),
      eq(customerWarehouseAssignments.customerId, customerId),
      eq(customerWarehouseAssignments.itemId, itemId)
    ];
    
    if (date) {
      conditions.push(
        or(
          isNull(customerWarehouseAssignments.effectiveDate),
          lte(customerWarehouseAssignments.effectiveDate, date.toISOString().split('T')[0])
        ),
        or(
          isNull(customerWarehouseAssignments.expirationDate),
          gte(customerWarehouseAssignments.expirationDate, date.toISOString().split('T')[0])
        )
      );
    }

    const query = this.db
      .select({
        assignment: customerWarehouseAssignments,
        warehouse: warehouses
      })
      .from(customerWarehouseAssignments)
      .innerJoin(warehouses, eq(customerWarehouseAssignments.warehouseId, warehouses.id))
      .where(and(...conditions));

    const results = await query;
    return results[0] || null;
  }

  /**
   * Find all warehouse assignments for a customer
   */
  async findCustomerWarehouseAssignments(customerId: string, organizationId: string) {
    return await this.db
      .select({
        assignment: customerWarehouseAssignments,
        warehouse: warehouses,
        item: items
      })
      .from(customerWarehouseAssignments)
      .innerJoin(warehouses, eq(customerWarehouseAssignments.warehouseId, warehouses.id))
      .innerJoin(items, eq(customerWarehouseAssignments.itemId, items.id))
      .where(
        and(
          eq(customerWarehouseAssignments.organizationId, organizationId),
          eq(customerWarehouseAssignments.customerId, customerId)
        )
      )
      .orderBy(items.itemCode);
  }

  /**
   * Update customer warehouse assignment
   */
  async updateCustomerWarehouseAssignment(
    id: string, 
    organizationId: string, 
    data: Partial<NewCustomerWarehouseAssignment>
  ): Promise<CustomerWarehouseAssignment | null> {
    // Verify ownership
    const belongsToOrg = await this.belongsToOrganization(customerWarehouseAssignments, id, organizationId);
    if (!belongsToOrg) {
      return null;
    }

    const results = await this.db
      .update(customerWarehouseAssignments)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(customerWarehouseAssignments.id, id),
          eq(customerWarehouseAssignments.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Remove customer warehouse assignment
   */
  async removeCustomerWarehouseAssignment(id: string, organizationId: string): Promise<boolean> {
    // Verify ownership
    const belongsToOrg = await this.belongsToOrganization(customerWarehouseAssignments, id, organizationId);
    if (!belongsToOrg) {
      return false;
    }

    await this.db
      .delete(customerWarehouseAssignments)
      .where(
        and(
          eq(customerWarehouseAssignments.id, id),
          eq(customerWarehouseAssignments.organizationId, organizationId)
        )
      );
    
    return true;
  }

  /**
   * Get customer price for an item based on warehouse assignment
   */
  async getCustomerWarehousePrice(params: WarehousePriceParams): Promise<WarehousePriceResult | null> {
    const { customerId, itemId, organizationId, date = new Date(), quantity = 1 } = params;

    // First, find the customer's assigned warehouse for this item
    const assignment = await this.findCustomerWarehouseAssignment(customerId, itemId, organizationId, date);
    if (!assignment) {
      return null;
    }

    // Get the warehouse's price lists in priority order
    const warehousePriceLists = await this.findWarehousePriceLists(assignment.warehouse.id, date);
    
    // Search for the item price in each price list
    for (const { warehousePriceList, priceList } of warehousePriceLists) {
      const itemPrices = await this.db
        .select()
        .from(itemPricing)
        .where(
          and(
            eq(itemPricing.itemId, itemId),
            eq(itemPricing.priceListId, priceList.id),
            lte(itemPricing.minQuantity, quantity.toString()),
            or(
              isNull(itemPricing.effectiveDate),
              lte(itemPricing.effectiveDate, date.toISOString().split('T')[0])
            ),
            or(
              isNull(itemPricing.expirationDate),
              gte(itemPricing.expirationDate, date.toISOString().split('T')[0])
            )
          )
        )
        .orderBy(desc(itemPricing.minQuantity))
        .limit(1);

      if (itemPrices.length > 0) {
        const price = itemPrices[0];
        return {
          warehouseId: assignment.warehouse.id,
          warehouseName: assignment.warehouse.name,
          priceListId: priceList.id,
          priceListName: priceList.name,
          unitPrice: parseFloat(price.unitPrice),
          minQuantity: parseFloat(price.minQuantity || '1'),
          effectiveDate: price.effectiveDate ? new Date(price.effectiveDate) : null,
          expirationDate: price.expirationDate ? new Date(price.expirationDate) : null
        };
      }
    }

    return null;
  }

  /**
   * Bulk assign customer warehouse assignments
   */
  async bulkAssignCustomerWarehouses(assignments: NewCustomerWarehouseAssignment[]): Promise<CustomerWarehouseAssignment[]> {
    if (assignments.length === 0) {
      return [];
    }

    const results = await this.db
      .insert(customerWarehouseAssignments)
      .values(assignments)
      .returning();
    
    return results;
  }
}