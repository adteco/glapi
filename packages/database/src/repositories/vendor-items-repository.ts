import { and, eq, or, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { vendorItems } from '../db/schema/vendor-items';
import type { VendorItem, NewVendorItem } from '../db/schema/vendor-items';

export interface VendorItemSearchParams {
  vendorId?: string;
  itemId?: string;
  isPreferred?: boolean;
}

export class VendorItemsRepository extends BaseRepository {
  /**
   * Find all vendor items based on search params
   */
  async find(params: VendorItemSearchParams = {}) {
    const conditions = [];
    
    if (params.vendorId) {
      conditions.push(eq(vendorItems.vendorId, params.vendorId));
    }
    
    if (params.itemId) {
      conditions.push(eq(vendorItems.itemId, params.itemId));
    }
    
    if (params.isPreferred !== undefined) {
      conditions.push(eq(vendorItems.isPreferred, params.isPreferred));
    }
    
    const query = this.db.select().from(vendorItems);
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(vendorItems.vendorId, vendorItems.itemId);
    }
    
    return await query.orderBy(vendorItems.vendorId, vendorItems.itemId);
  }

  /**
   * Find vendors for an item
   */
  async findVendorsForItem(itemId: string) {
    return await this.db
      .select()
      .from(vendorItems)
      .where(eq(vendorItems.itemId, itemId))
      .orderBy(desc(vendorItems.isPreferred), vendorItems.vendorId);
  }

  /**
   * Find items for a vendor
   */
  async findItemsForVendor(vendorId: string) {
    return await this.db
      .select()
      .from(vendorItems)
      .where(eq(vendorItems.vendorId, vendorId))
      .orderBy(vendorItems.itemId);
  }

  /**
   * Find a specific vendor-item relationship
   */
  async findByVendorAndItem(vendorId: string, itemId: string) {
    const results = await this.db
      .select()
      .from(vendorItems)
      .where(
        and(
          eq(vendorItems.vendorId, vendorId),
          eq(vendorItems.itemId, itemId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Get the preferred vendor for an item
   */
  async getPreferredVendor(itemId: string) {
    const results = await this.db
      .select()
      .from(vendorItems)
      .where(
        and(
          eq(vendorItems.itemId, itemId),
          eq(vendorItems.isPreferred, true)
        )
      )
      .limit(1);
    
    return results[0] || null;
  }

  /**
   * Create a vendor-item relationship
   */
  async create(data: NewVendorItem) {
    // If marking as preferred, unset other preferred vendors for this item
    if (data.isPreferred) {
      await this.unsetPreferredVendors(data.itemId);
    }

    const results = await this.db
      .insert(vendorItems)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a vendor-item relationship
   */
  async update(id: string, data: Partial<NewVendorItem>) {
    // If marking as preferred, unset other preferred vendors
    if (data.isPreferred === true) {
      const current = await this.findById(id);
      if (current) {
        await this.unsetPreferredVendors(current.itemId, id);
      }
    }

    const results = await this.db
      .update(vendorItems)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(vendorItems.id, id))
      .returning();
    
    return results[0] || null;
  }

  /**
   * Delete a vendor-item relationship
   */
  async delete(vendorId: string, itemId: string) {
    return await this.db
      .delete(vendorItems)
      .where(
        and(
          eq(vendorItems.vendorId, vendorId),
          eq(vendorItems.itemId, itemId)
        )
      );
  }

  /**
   * Set a vendor as preferred for an item
   */
  async setPreferredVendor(vendorId: string, itemId: string) {
    // First, unset all other preferred vendors for this item
    await this.unsetPreferredVendors(itemId);

    // Then set this vendor as preferred
    const existing = await this.findByVendorAndItem(vendorId, itemId);
    
    if (existing) {
      return await this.update(existing.id, { isPreferred: true });
    } else {
      return await this.create({
        vendorId,
        itemId,
        isPreferred: true,
      });
    }
  }

  /**
   * Unset preferred vendors for an item
   */
  private async unsetPreferredVendors(itemId: string, excludeId?: string) {
    const conditions = [
      eq(vendorItems.itemId, itemId),
      eq(vendorItems.isPreferred, true)
    ];

    if (excludeId) {
      conditions.push(sql`${vendorItems.id} != ${excludeId}`);
    }

    return await this.db
      .update(vendorItems)
      .set({ isPreferred: false })
      .where(and(...conditions));
  }

  /**
   * Update purchase information after a purchase
   */
  async updatePurchaseInfo(
    vendorId: string,
    itemId: string,
    purchasePrice: string,
    purchaseDate: Date = new Date()
  ) {
    const existing = await this.findByVendorAndItem(vendorId, itemId);
    
    if (existing) {
      return await this.update(existing.id, {
        lastPurchaseDate: purchaseDate.toISOString().split('T')[0],
        lastPurchasePrice: purchasePrice,
      });
    }
    
    return null;
  }

  /**
   * Find a vendor item by ID
   */
  private async findById(id: string) {
    const results = await this.db
      .select()
      .from(vendorItems)
      .where(eq(vendorItems.id, id));
    
    return results[0] || null;
  }

  /**
   * Get vendor cost for an item
   */
  async getVendorCost(vendorId: string, itemId: string): Promise<string | null> {
    const vendorItem = await this.findByVendorAndItem(vendorId, itemId);
    return vendorItem?.vendorUnitCost || null;
  }

  /**
   * Get the best (lowest) vendor cost for an item
   */
  async getBestVendorCost(itemId: string): Promise<{ vendorId: string; cost: string } | null> {
    const results = await this.db
      .select()
      .from(vendorItems)
      .where(
        and(
          eq(vendorItems.itemId, itemId),
          sql`${vendorItems.vendorUnitCost} IS NOT NULL`
        )
      )
      .orderBy(vendorItems.vendorUnitCost)
      .limit(1);

    const vendorItem = results[0];
    if (!vendorItem || !vendorItem.vendorUnitCost) {
      return null;
    }

    return {
      vendorId: vendorItem.vendorId,
      cost: vendorItem.vendorUnitCost,
    };
  }

  /**
   * Get items that need reordering based on lead time
   * This is a placeholder - would need inventory levels to properly implement
   */
  async getItemsNeedingReorder(vendorId: string, daysAhead: number = 7) {
    // TODO: Implement when inventory tracking is added
    // Would check current inventory levels vs lead time
    return [];
  }
}