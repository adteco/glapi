import { and, eq, lte, gte, or, sql, desc } from 'drizzle-orm';
import type { PgSelect } from 'drizzle-orm/pg-core';
import { BaseRepository } from './base-repository';
import { lotNumbers, serialNumbers } from '../db/schema/inventory-tracking';
import type { LotNumber, NewLotNumber, SerialNumber, NewSerialNumber } from '../db/schema/inventory-tracking';

export interface LotSearchParams {
  itemId?: string;
  status?: string;
  expiringWithinDays?: number;
  includeExpired?: boolean;
}

export interface SerialSearchParams {
  itemId?: string;
  status?: string;
  vendorId?: string;
  customerId?: string;
  serialNumber?: string;
}

export class InventoryTrackingRepository extends BaseRepository {
  // Lot Number Methods

  /**
   * Find lot numbers based on search params
   */
  async findLots(organizationId: string, params: LotSearchParams = {}) {
    const conditions = [eq(lotNumbers.organizationId, organizationId)];

    if (params.itemId) {
      conditions.push(eq(lotNumbers.itemId, params.itemId));
    }

    if (params.status) {
      conditions.push(eq(lotNumbers.status, params.status as any));
    }

    if (params.expiringWithinDays) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + params.expiringWithinDays);
      conditions.push(
        and(
          sql`${lotNumbers.expirationDate} IS NOT NULL`,
          lte(lotNumbers.expirationDate, expirationDate.toISOString())
        )!
      );
    }

    if (!params.includeExpired) {
      conditions.push(
        or(
          sql`${lotNumbers.expirationDate} IS NULL`,
          gte(lotNumbers.expirationDate, new Date().toISOString())
        )!
      );
    }

    return await this.db
      .select()
      .from(lotNumbers)
      .where(and(...conditions))
      .orderBy(lotNumbers.expirationDate, lotNumbers.lotNumber);
  }

  /**
   * Find a lot by ID
   */
  async findLotById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(lotNumbers)
      .where(
        and(
          eq(lotNumbers.id, id),
          eq(lotNumbers.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a lot by lot number
   */
  async findLotByNumber(lotNumber: string, itemId: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(lotNumbers)
      .where(
        and(
          eq(lotNumbers.lotNumber, lotNumber),
          eq(lotNumbers.itemId, itemId),
          eq(lotNumbers.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Create a new lot number
   */
  async createLot(data: NewLotNumber) {
    const results = await this.db
      .insert(lotNumbers)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a lot number
   */
  async updateLot(id: string, organizationId: string, data: Partial<NewLotNumber>) {
    const results = await this.db
      .update(lotNumbers)
      .set(data)
      .where(
        and(
          eq(lotNumbers.id, id),
          eq(lotNumbers.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Update lot quantity on hand
   */
  async updateLotQuantity(
    id: string,
    organizationId: string,
    quantityChange: number
  ) {
    const lot = await this.findLotById(id, organizationId);
    if (!lot) {
      throw new Error('Lot not found');
    }

    const newQuantity = parseFloat(lot.quantityOnHand) + quantityChange;
    if (newQuantity < 0) {
      throw new Error('Insufficient quantity in lot');
    }

    return await this.updateLot(id, organizationId, {
      quantityOnHand: newQuantity.toString(),
    });
  }

  /**
   * Get lots expiring soon
   */
  async getExpiringLots(organizationId: string, daysAhead: number = 30) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysAhead);

    return await this.db
      .select()
      .from(lotNumbers)
      .where(
        and(
          eq(lotNumbers.organizationId, organizationId),
          eq(lotNumbers.status, 'ACTIVE'),
          sql`${lotNumbers.expirationDate} IS NOT NULL`,
          lte(lotNumbers.expirationDate, expirationDate.toISOString()),
          gte(lotNumbers.expirationDate, new Date().toISOString())
        )
      )
      .orderBy(lotNumbers.expirationDate);
  }

  /**
   * Mark expired lots
   */
  async markExpiredLots(organizationId: string) {
    return await this.db
      .update(lotNumbers)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(lotNumbers.organizationId, organizationId),
          eq(lotNumbers.status, 'ACTIVE'),
          sql`${lotNumbers.expirationDate} IS NOT NULL`,
          lte(lotNumbers.expirationDate, new Date().toISOString())
        )
      );
  }

  // Serial Number Methods

  /**
   * Find serial numbers based on search params
   */
  async findSerials(organizationId: string, params: SerialSearchParams = {}) {
    const conditions = [eq(serialNumbers.organizationId, organizationId)];

    if (params.itemId) {
      conditions.push(eq(serialNumbers.itemId, params.itemId));
    }

    if (params.status) {
      conditions.push(eq(serialNumbers.status, params.status as any));
    }

    if (params.vendorId) {
      conditions.push(eq(serialNumbers.purchaseVendorId, params.vendorId));
    }

    if (params.customerId) {
      conditions.push(eq(serialNumbers.saleCustomerId, params.customerId));
    }

    if (params.serialNumber) {
      conditions.push(eq(serialNumbers.serialNumber, params.serialNumber));
    }

    return await this.db
      .select()
      .from(serialNumbers)
      .where(and(...conditions))
      .orderBy(serialNumbers.serialNumber);
  }

  /**
   * Find a serial by ID
   */
  async findSerialById(id: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(serialNumbers)
      .where(
        and(
          eq(serialNumbers.id, id),
          eq(serialNumbers.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Find a serial by serial number
   */
  async findSerialByNumber(serialNumber: string, organizationId: string) {
    const results = await this.db
      .select()
      .from(serialNumbers)
      .where(
        and(
          eq(serialNumbers.serialNumber, serialNumber),
          eq(serialNumbers.organizationId, organizationId)
        )
      );
    
    return results[0] || null;
  }

  /**
   * Create a new serial number
   */
  async createSerial(data: NewSerialNumber) {
    const results = await this.db
      .insert(serialNumbers)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Create multiple serial numbers
   */
  async createManySerials(data: NewSerialNumber[]) {
    return await this.db
      .insert(serialNumbers)
      .values(data)
      .returning();
  }

  /**
   * Update a serial number
   */
  async updateSerial(id: string, organizationId: string, data: Partial<NewSerialNumber>) {
    const results = await this.db
      .update(serialNumbers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serialNumbers.id, id),
          eq(serialNumbers.organizationId, organizationId)
        )
      )
      .returning();
    
    return results[0] || null;
  }

  /**
   * Update serial status
   */
  async updateSerialStatus(
    id: string,
    organizationId: string,
    status: 'AVAILABLE' | 'SOLD' | 'IN_TRANSIT' | 'RETURNED' | 'DAMAGED' | 'LOST',
    additionalData?: {
      vendorId?: string;
      customerId?: string;
      purchaseDate?: Date;
      saleDate?: Date;
    }
  ) {
    const updateData: Partial<NewSerialNumber> = { status };

    // Set additional fields based on status
    if (status === 'SOLD' && additionalData?.customerId) {
      updateData.saleCustomerId = additionalData.customerId;
      const saleDate = additionalData.saleDate || new Date();
      updateData.saleDate = saleDate.toISOString();
    }

    if (status === 'AVAILABLE' && additionalData?.vendorId) {
      updateData.purchaseVendorId = additionalData.vendorId;
      const purchaseDate = additionalData.purchaseDate || new Date();
      updateData.purchaseDate = purchaseDate.toISOString();
    }

    return await this.updateSerial(id, organizationId, updateData);
  }

  /**
   * Get available serials for an item
   */
  async getAvailableSerials(itemId: string, organizationId: string, limit?: number) {
    
    const queryBuilder = this.db
      .select()
      .from(serialNumbers)
      .where(
        and(
          eq(serialNumbers.organizationId, organizationId),
          eq(serialNumbers.itemId, itemId),
          eq(serialNumbers.status, 'AVAILABLE')
        )
      )
      .orderBy(serialNumbers.createdAt);

    if (limit) {
      return await (queryBuilder as any).limit(limit);
    }

    return await queryBuilder;
  }

  /**
   * Allocate serials for a sale
   */
  async allocateSerialsForSale(
    itemId: string,
    organizationId: string,
    quantity: number,
    customerId: string
  ): Promise<SerialNumber[]> {
    const availableSerials = await this.getAvailableSerials(
      itemId,
      organizationId,
      quantity
    );

    if (availableSerials.length < quantity) {
      throw new Error(`Only ${availableSerials.length} serials available, ${quantity} requested`);
    }

    const allocatedSerials: SerialNumber[] = [];

    for (const serial of availableSerials) {
      const updated = await this.updateSerialStatus(
        serial.id,
        organizationId,
        'SOLD',
        { customerId, saleDate: new Date() }
      );
      
      if (updated) {
        allocatedSerials.push(updated);
      }
    }

    return allocatedSerials;
  }

  /**
   * Get warranty expiring serials
   */
  async getWarrantyExpiringSerials(organizationId: string, daysAhead: number = 30) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysAhead);

    return await this.db
      .select()
      .from(serialNumbers)
      .where(
        and(
          eq(serialNumbers.organizationId, organizationId),
          sql`${serialNumbers.warrantyExpirationDate} IS NOT NULL`,
          lte(serialNumbers.warrantyExpirationDate, expirationDate.toISOString()),
          gte(serialNumbers.warrantyExpirationDate, new Date().toISOString())
        )
      )
      .orderBy(serialNumbers.warrantyExpirationDate);
  }

  /**
   * Get serial history (tracking changes would require audit log)
   */
  async getSerialHistory(serialNumber: string, organizationId: string) {
    // TODO: Implement when audit log is integrated
    // Would query item_audit_log for changes to this serial
    return [];
  }

  /**
   * Check if item requires lot tracking
   */
  async itemRequiresLotTracking(itemId: string): Promise<boolean> {
    // This would typically check the item's trackLotNumbers flag
    // Implemented in items repository
    return false;
  }

  /**
   * Check if item requires serial tracking
   */
  async itemRequiresSerialTracking(itemId: string): Promise<boolean> {
    // This would typically check the item's trackSerialNumbers flag
    // Implemented in items repository
    return false;
  }
}